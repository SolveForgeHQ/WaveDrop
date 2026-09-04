import { MerkleTree } from "merkletreejs";
import { keccak256, AbiCoder, getBytes } from "ethers";
import { prisma } from "../db/prisma.js";
import { payoutRepo } from "../repositories/payout.repo.js";
import { waveRepo } from "../repositories/wave.repo.js";

/**
 * Encodes a (address, amount) leaf exactly as the Solidity contract does:
 *   keccak256(abi.encodePacked(address, uint256))
 *
 * We use ethers AbiCoder.defaultAbiCoder().encode() for ABI encoding but
 * the contract uses abi.encodePacked — so we must pack manually:
 *   packed = address (20 bytes) + uint256 (32 bytes)
 */
function encodeLeaf(address: string, amountUsdc: bigint): Buffer {
  // abi.encodePacked(address, uint256):
  //   address is 20 bytes (no padding), uint256 is 32 bytes big-endian
  const addrBytes  = getBytes(address);                       // 20 bytes
  const amountHex  = amountUsdc.toString(16).padStart(64, "0"); // 32 bytes hex
  const amountBytes = getBytes("0x" + amountHex);             // 32 bytes
  const packed     = new Uint8Array(52);
  packed.set(addrBytes,   0);
  packed.set(amountBytes, 20);
  return Buffer.from(keccak256(packed).slice(2), "hex");
}

export interface MerkleGenerationResult {
  merkleRoot:  string;
  totalLeaves: number;
  payouts: Array<{
    walletAddress: string;
    amountUsdc:    string;
    totalPoints:   number;
    merkleProof:   string[];
  }>;
}

/**
 * Generate a Merkle tree for a closed wave:
 *  1. Aggregate PointsLedger totals per contributor.
 *  2. Convert points → USDC proportional to the pool.
 *  3. Build the Merkle tree (leaf = keccak256(abi.encodePacked(addr, amount))).
 *  4. Persist Payout rows with proofs.
 *  5. Return the root + per-contributor proof data.
 */
export async function generateMerkleTree(waveId: string): Promise<MerkleGenerationResult> {
  const wave = await prisma.wave.findUnique({ where: { id: waveId } });
  if (!wave) throw new Error(`Wave not found: ${waveId}`);
  if (wave.status !== "CLOSED") {
    throw new Error(`Wave must be CLOSED before generating Merkle tree (status: ${wave.status})`);
  }

  // 1. Aggregate points per contributor
  const ledgerTotals = await prisma.pointsLedger.groupBy({
    by:    ["contributorId"],
    where: { waveId },
    _sum:  { points: true },
  });

  if (ledgerTotals.length === 0) {
    throw new Error("No points recorded for this wave — nothing to distribute");
  }

  // 2. Fetch contributor wallet addresses
  const contributorIds = ledgerTotals.map((t: { contributorId: string }) => t.contributorId);
  const contributors   = await prisma.contributor.findMany({
    where:  { id: { in: contributorIds } },
    select: { id: true, walletAddress: true, githubLogin: true },
  });

  const walletMap = new Map(contributors.map((c: { id: string; walletAddress: string | null }) => [c.id, c.walletAddress]));

  // Filter out contributors without a linked wallet — they forfeit their share
  const eligible = ledgerTotals.filter((t: { contributorId: string; _sum: { points: number | null } }) => walletMap.get(t.contributorId));

  if (eligible.length === 0) {
    throw new Error("No contributors have linked a wallet address");
  }

  const totalPoints = eligible.reduce((sum: number, t: { _sum: { points: number | null } }) => sum + (t._sum.points ?? 0), 0);

  // 3. Convert points → USDC (pool stored as human-readable, convert to 6-dec bigint)
  const poolUsdc = BigInt(
    Math.round(parseFloat(wave.poolAmountUsdc) * 1_000_000)
  );

  const allocations = eligible.map((t: { contributorId: string; _sum: { points: number | null } }) => {
    const points     = t._sum.points ?? 0;
    const amountUsdc = (poolUsdc * BigInt(points)) / BigInt(totalPoints);
    const wallet     = walletMap.get(t.contributorId) as string; // guarded above
    return { contributorId: t.contributorId, wallet, points, amountUsdc };
  });

  // 4. Build Merkle tree
  const leaves = allocations.map(({ wallet, amountUsdc }: { wallet: string; amountUsdc: bigint }) =>
    encodeLeaf(wallet, amountUsdc)
  );

  const tree = new MerkleTree(leaves, (data: Buffer) =>
    Buffer.from(keccak256(data).slice(2), "hex"),
    { sortPairs: true }   // must match OZ MerkleProof.verify (commutative/sorted)
  );

  const merkleRoot = "0x" + tree.getRoot().toString("hex");

  // 5. Persist payout rows with proofs
  const payoutInputs = allocations.map((alloc: { contributorId: string; wallet: string; points: number; amountUsdc: bigint }, i: number) => {
    const leaf  = leaves[i] as Buffer;
    const proof = tree.getProof(leaf).map((p: { data: Buffer }) => "0x" + p.data.toString("hex"));
    return {
      waveId,
      contributorId: alloc.contributorId,
      walletAddress: alloc.wallet,
      totalPoints:   alloc.points,
      amountUsdc:    alloc.amountUsdc.toString(),
      merkleProof:   proof,
    };
  });

  await payoutRepo.createMany(payoutInputs);

  return {
    merkleRoot,
    totalLeaves: allocations.length,
    payouts: payoutInputs.map((p: { walletAddress: string; amountUsdc: string; totalPoints: number; merkleProof: string[] }) => ({
      walletAddress: p.walletAddress,
      amountUsdc:    p.amountUsdc,
      totalPoints:   p.totalPoints,
      merkleProof:   p.merkleProof,
    })),
  };
}

/**
 * Called after the operator has submitted the Merkle root on-chain.
 * Transitions the wave to SETTLED and stores the root.
 */
export async function finaliseWaveOnChain(
  waveId:       string,
  merkleRoot:   string,
  onChainWaveId?: string
) {
  return waveRepo.setMerkleRoot(waveId, merkleRoot, onChainWaveId);
}

/**
 * Return the proof and amount for a specific wallet address in a settled wave.
 * This is what the frontend calls to get the data for MerkleClaim.claim().
 */
export async function getClaimProof(waveId: string, walletAddress: string) {
  const wave = await prisma.wave.findUnique({ where: { id: waveId } });
  if (!wave)            throw new Error(`Wave not found: ${waveId}`);
  if (!wave.merkleRoot) throw new Error(`Wave ${waveId} has no Merkle root yet`);

  const payout = await payoutRepo.findByWaveAndWallet(waveId, walletAddress);
  if (!payout) throw new Error(`No payout found for ${walletAddress} in wave ${waveId}`);

  return {
    merkleRoot:  wave.merkleRoot,
    walletAddress: payout.walletAddress,
    amountUsdc:  payout.amountUsdc,
    totalPoints: payout.totalPoints,
    merkleProof: payout.merkleProof,
    claimedAt:   payout.claimedAt,
  };
}
