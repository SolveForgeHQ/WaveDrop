import { prisma } from "../db/prisma.js";
// Prisma model types are inferred from the client after `prisma generate`.
// Using ReturnType inference avoids importing generated types directly.
type Contributor = Awaited<ReturnType<typeof prisma.contributor.findUniqueOrThrow>>;

export interface UpsertContributorInput {
  githubId: number;
  githubLogin: string;
  githubEmail?: string | null;
  avatarUrl?: string | null;
  accessToken?: string | null;
}

export const contributorRepo = {
  async upsert(input: UpsertContributorInput): Promise<Contributor> {
    return prisma.contributor.upsert({
      where: { githubId: input.githubId },
      create: {
        githubId:    input.githubId,
        githubLogin: input.githubLogin,
        githubEmail: input.githubEmail,
        avatarUrl:   input.avatarUrl,
        accessToken: input.accessToken,
      },
      update: {
        githubLogin: input.githubLogin,
        githubEmail: input.githubEmail,
        avatarUrl:   input.avatarUrl,
        accessToken: input.accessToken,
      },
    });
  },

  async findById(id: string): Promise<Contributor | null> {
    return prisma.contributor.findUnique({ where: { id } });
  },

  async findByGithubId(githubId: number): Promise<Contributor | null> {
    return prisma.contributor.findUnique({ where: { githubId } });
  },

  async findByLogin(login: string): Promise<Contributor | null> {
    return prisma.contributor.findUnique({ where: { githubLogin: login } });
  },

  async setWalletAddress(id: string, walletAddress: string): Promise<Contributor> {
    return prisma.contributor.update({
      where: { id },
      data:  { walletAddress },
    });
  },
};
