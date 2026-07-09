import { prisma } from "../db/prisma.js";

export interface CreatePayoutInput {
  waveId:        string;
  contributorId: string;
  walletAddress: string;
  totalPoints:   number;
  amountUsdc:    string;
  merkleProof:   string[];
}

export const payoutRepo = {
  async createMany(payouts: CreatePayoutInput[]) {
    // Upsert so re-running settlement is idempotent
    return prisma.$transaction(
      payouts.map((p) =>
        prisma.payout.upsert({
          where:  { waveId_contributorId: { waveId: p.waveId, contributorId: p.contributorId } },
          create: p,
          update: { amountUsdc: p.amountUsdc, merkleProof: p.merkleProof, totalPoints: p.totalPoints },
        })
      )
    );
  },

  async findByWaveAndWallet(waveId: string, walletAddress: string) {
    return prisma.payout.findFirst({
      where: { waveId, walletAddress: { equals: walletAddress, mode: "insensitive" } },
    });
  },

  async findByWave(waveId: string) {
    return prisma.payout.findMany({
      where:   { waveId },
      include: { contributor: { select: { githubLogin: true, avatarUrl: true } } },
    });
  },

  async markClaimed(id: string, claimedAt: Date) {
    return prisma.payout.update({ where: { id }, data: { claimedAt } });
  },

  async recordOnChainClaim(input: {
    waveId:        string;
    payoutId:      string;
    walletAddress: string;
    amountUsdc:    string;
    txHash:        string;
  }) {
    return prisma.$transaction([
      prisma.merkleClaim.create({ data: input }),
      prisma.payout.update({
        where: { id: input.payoutId },
        data:  { claimedAt: new Date() },
      }),
    ]);
  },
};
