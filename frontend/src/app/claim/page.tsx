"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount, useConnect, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { injected } from "wagmi/connectors";
import { api } from "../../lib/api";
import { Card, CardHeader, CardTitle } from "../../components/ui/Card";
import { Button }    from "../../components/ui/Button";
import { Badge }     from "../../components/ui/Badge";
import { Input, Label } from "../../components/ui/Input";
import { PageSpinner, Spinner } from "../../components/ui/Spinner";

// MerkleClaim ABI — only the claim function
const MERKLE_CLAIM_ABI = [
  {
    name: "claim",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "waveId",  type: "bytes32"   },
      { name: "amount",  type: "uint256"   },
      { name: "proof",   type: "bytes32[]" },
    ],
    outputs: [],
  },
] as const;

const MERKLE_CLAIM_ADDRESS = (
  process.env.NEXT_PUBLIC_MERKLE_CLAIM_ADDRESS ?? "0x0000000000000000000000000000000000000000"
) as `0x${string}`;

export default function ClaimPage() {
  const { address, isConnected } = useAccount();
  const { connect }  = useConnect();
  const qc           = useQueryClient();

  const [waveId, setWaveId] = useState("");
  const [searched, setSearched] = useState("");

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: api.auth.me, retry: false });

  const resolvedAddress = address ?? me?.walletAddress as `0x${string}` | undefined;

  const {
    data:      proof,
    isLoading: proofLoading,
    error:     proofError,
  } = useQuery({
    queryKey:  ["claim-proof", searched, resolvedAddress],
    queryFn:   () => api.claims.getProof(searched, resolvedAddress!),
    enabled:   !!searched && !!resolvedAddress,
  });

  const {
    writeContract,
    data:    txHash,
    isPending: txPending,
    error:   writeError,
  } = useWriteContract();

  const { isLoading: confirming, isSuccess: confirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Record the claim once confirmed on-chain
  const recordMutation = useMutation({
    mutationFn: () => api.claims.record(searched, {
      walletAddress: resolvedAddress!,
      amountUsdc:    proof!.amountUsdc,
      txHash:        txHash!,
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["claim-proof"] }),
  });

  // Trigger record once confirmed
  if (confirmed && txHash && !recordMutation.isSuccess && !recordMutation.isPending) {
    recordMutation.mutate();
  }

  const handleClaim = () => {
    if (!proof || !resolvedAddress) return;

    writeContract({
      address: MERKLE_CLAIM_ADDRESS,
      abi:     MERKLE_CLAIM_ABI,
      functionName: "claim",
      args: [
        proof.merkleProof[0] as `0x${string}`,           // waveId (onChainWaveId)
        BigInt(proof.amountUsdc),
        proof.merkleProof as `0x${string}`[],
      ],
    });
  };

  const usdcAmount = proof ? (Number(proof.amountUsdc) / 1_000_000).toFixed(2) : "0.00";

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold text-[#f0f0f4] mb-2">Claim Rewards</h1>
      <p className="text-sm text-[#55556a] mb-6">
        After a wave settles, enter the wave ID to check your USDC allocation and claim it on-chain.
      </p>

      {/* Wallet check */}
      {!isConnected && (
        <Card className="mb-4 border-[#7c5cfc40]">
          <p className="text-xs text-[#8888a0] mb-3">Connect your wallet to claim.</p>
          <Button variant="primary" size="sm" onClick={() => connect({ connector: injected() })}>
            Connect Wallet
          </Button>
        </Card>
      )}

      {/* Wave ID input */}
      <Card className="mb-4">
        <Label htmlFor="waveid">Wave ID</Label>
        <div className="flex gap-2">
          <Input
            id="waveid"
            placeholder="Enter wave ID..."
            value={waveId}
            onChange={(e) => setWaveId(e.target.value)}
          />
          <Button
            onClick={() => setSearched(waveId.trim())}
            disabled={!waveId.trim() || !resolvedAddress}
          >
            Check
          </Button>
        </div>
        {!resolvedAddress && (
          <p className="text-xs text-[#55556a] mt-2">Connect wallet or sign in to check eligibility.</p>
        )}
      </Card>

      {proofLoading && <PageSpinner />}

      {proofError && (
        <Card className="border-[#ef444440]">
          <p className="text-sm text-[#ef4444]">
            No payout found for this wallet in wave {searched}.
          </p>
        </Card>
      )}

      {proof && (
        <Card>
          <CardHeader>
            <CardTitle>Your Allocation</CardTitle>
            {proof.claimedAt ? (
              <Badge variant="muted">Claimed</Badge>
            ) : (
              <Badge variant="success">Claimable</Badge>
            )}
          </CardHeader>

          <div className="space-y-4">
            <div className="bg-[#0a0a0f] rounded-lg p-4 text-center">
              <p className="text-xs text-[#55556a] mb-1">USDC Amount</p>
              <p className="text-3xl font-bold text-[#f0f0f4]">${usdcAmount}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-[#55556a]">Points Earned</p>
                <p className="font-medium text-[#f0f0f4]">{proof.totalPoints.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-[#55556a]">Wallet</p>
                <p className="font-mono text-xs text-[#8888a0] truncate">{proof.walletAddress}</p>
              </div>
            </div>

            <details className="text-xs">
              <summary className="text-[#55556a] cursor-pointer hover:text-[#8888a0]">
                View Merkle proof ({proof.merkleProof.length} nodes)
              </summary>
              <div className="mt-2 bg-[#0a0a0f] rounded p-3 space-y-1">
                {proof.merkleProof.map((p, i) => (
                  <p key={i} className="font-mono text-[#55556a] break-all">{p}</p>
                ))}
              </div>
            </details>

            {proof.claimedAt ? (
              <p className="text-xs text-[#55556a] text-center">
                Claimed on {new Date(proof.claimedAt).toLocaleDateString()}
              </p>
            ) : confirmed ? (
              <div className="text-center">
                <p className="text-sm text-[#22c55e] font-medium">🎉 Claimed successfully!</p>
                {txHash && (
                  <a
                    href={`https://testnet.snowtrace.io/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#7c5cfc] mt-1 block"
                  >
                    View on Snowtrace →
                  </a>
                )}
              </div>
            ) : confirming ? (
              <div className="flex items-center justify-center gap-2">
                <Spinner size={14} />
                <span className="text-xs text-[#55556a]">Confirming transaction…</span>
              </div>
            ) : (
              <Button
                variant="primary"
                className="w-full justify-center"
                onClick={handleClaim}
                loading={txPending}
                disabled={!isConnected}
              >
                Claim ${usdcAmount} USDC
              </Button>
            )}

            {writeError && (
              <p className="text-xs text-[#ef4444]">{writeError.message.slice(0, 120)}</p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
