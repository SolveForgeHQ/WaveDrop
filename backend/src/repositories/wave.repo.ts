import { prisma } from "../db/prisma.js";

export type WaveStatus = "UPCOMING" | "ACTIVE" | "CLOSED" | "SETTLED";
type Wave = Awaited<ReturnType<typeof prisma.wave.findUniqueOrThrow>>;

export interface CreateWaveInput {
  ecosystemId:    string;
  name:           string;
  description?:   string;
  poolAmountUsdc: string;
  startsAt:       Date;
  endsAt:         Date;
}

export const waveRepo = {
  async create(input: CreateWaveInput): Promise<Wave> {
    return prisma.wave.create({ data: input });
  },

  async findById(id: string) {
    return prisma.wave.findUnique({
      where:   { id },
      include: { ecosystem: true, repositories: { include: { repository: true } } },
    });
  },

  async findAll(status?: WaveStatus) {
    const where = status ? { status } : {};
    return prisma.wave.findMany({
      where,
      orderBy: { startsAt: "desc" },
      include: { ecosystem: true },
    });
  },

  async updateStatus(id: string, status: WaveStatus): Promise<Wave> {
    return prisma.wave.update({ where: { id }, data: { status } });
  },

  async setMerkleRoot(id: string, merkleRoot: string, onChainWaveId?: string): Promise<Wave> {
    return prisma.wave.update({
      where: { id },
      data:  { merkleRoot, onChainWaveId, status: "SETTLED" },
    });
  },

  async addRepository(waveId: string, repositoryId: string) {
    return prisma.waveRepo.upsert({
      where:  { waveId_repositoryId: { waveId, repositoryId } },
      create: { waveId, repositoryId },
      update: {},
    });
  },
};
