import { prisma } from "../db/prisma.js";
import { waveRepo, type CreateWaveInput, type WaveStatus } from "../repositories/wave.repo.js";
import { issueRepo, POINTS_BY_COMPLEXITY, type Complexity } from "../repositories/issue.repo.js";

export interface AddRepoToWaveInput {
  waveId:       string;
  repoOwner:    string;
  repoName:     string;
  ecosystemId:  string;
  issues: Array<{
    githubNumber: number;
    title:        string;
    url:          string;
    complexity:   Complexity;
  }>;
}

export const waveService = {
  async createWave(input: CreateWaveInput) {
    if (new Date(input.startsAt) >= new Date(input.endsAt)) {
      throw new Error("startsAt must be before endsAt");
    }
    return waveRepo.create(input);
  },

  async getWave(id: string) {
    const wave = await waveRepo.findById(id);
    if (!wave) throw new Error(`Wave not found: ${id}`);
    return wave;
  },

  async listWaves(status?: string) {
    return waveRepo.findAll(status as WaveStatus | undefined);
  },

  /**
   * Add a repository to a wave and upsert tagged issues.
   * Creates the Repository record if it doesn't exist yet.
   */
  async addRepoWithIssues(input: AddRepoToWaveInput) {
    // Upsert the repository
    const repo = await prisma.repository.upsert({
      where:  { owner_name: { owner: input.repoOwner, name: input.repoName } },
      create: { owner: input.repoOwner, name: input.repoName, ecosystemId: input.ecosystemId },
      update: {},
    });

    // Link repo to wave
    await waveRepo.addRepository(input.waveId, repo.id);

    // Upsert issues with point values
    const upserted = await Promise.all(
      input.issues.map((issue) =>
        issueRepo.upsert({
          repositoryId: repo.id,
          githubNumber: issue.githubNumber,
          title:        issue.title,
          url:          issue.url,
          complexity:   issue.complexity,
          points:       POINTS_BY_COMPLEXITY[issue.complexity],
        })
      )
    );

    return { repository: repo, issues: upserted };
  },

  /**
   * Close a wave: freeze the ledger status.
   * Merkle tree generation is triggered separately via merkle.service.
   */
  async closeWave(id: string) {
    const wave = await waveRepo.findById(id);
    if (!wave) throw new Error(`Wave not found: ${id}`);
    if (wave.status !== "ACTIVE") {
      throw new Error(`Wave must be ACTIVE to close (current: ${wave.status})`);
    }
    return waveRepo.updateStatus(id, "CLOSED");
  },
};
