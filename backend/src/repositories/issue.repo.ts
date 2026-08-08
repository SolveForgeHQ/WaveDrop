import { prisma } from "../db/prisma.js";

// Complexity and WaveStatus are enums — reference them via the Prisma namespace
// after `prisma generate`. Until then we use string literal unions.
export type Complexity = "EASY" | "MEDIUM" | "HARD";

export interface UpsertIssueInput {
  repositoryId: string;
  githubNumber: number;
  title:        string;
  url:          string;
  complexity:   Complexity;
  points:       number;
}

export interface IssueFilter {
  waveId?:     string;
  complexity?: Complexity;
  isOpen?:     boolean;
  page?:       number;
  pageSize?:   number;
}

export const POINTS_BY_COMPLEXITY: Record<Complexity, number> = {
  EASY:   100,
  MEDIUM: 150,
  HARD:   200,
};

export const issueRepo = {
  async upsert(input: UpsertIssueInput) {
    return prisma.issue.upsert({
      where: {
        repositoryId_githubNumber: {
          repositoryId: input.repositoryId,
          githubNumber: input.githubNumber,
        },
      },
      create: input,
      update: {
        title:      input.title,
        url:        input.url,
        complexity: input.complexity,
        points:     input.points,
      },
    });
  },

  async findByWave(filter: IssueFilter) {
    const page     = filter.page     ?? 1;
    const pageSize = filter.pageSize ?? 20;
    const skip     = (page - 1) * pageSize;

    // Build where clause dynamically — typed loosely until prisma generate runs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};

    if (filter.complexity) where["complexity"] = filter.complexity;
    if (filter.isOpen !== undefined) where["isOpen"] = filter.isOpen;

    if (filter.waveId) {
      where["repository"] = {
        waves: { some: { waveId: filter.waveId } },
      };
    }

    const [items, total] = await Promise.all([
      prisma.issue.findMany({
        where,
        skip,
        take:    pageSize,
        orderBy: { points: "desc" },
        include: {
          repository: { select: { owner: true, name: true } },
          _count: { select: { applications: true } },
        },
      }),
      prisma.issue.count({ where }),
    ]);

    return { items, total, page, pageSize };
  },

  async markClaimed(id: string) {
    return prisma.issue.update({ where: { id }, data: { isClaimed: true, isOpen: false } });
  },

  async findByRepoAndNumber(repositoryId: string, githubNumber: number) {
    return prisma.issue.findUnique({
      where: { repositoryId_githubNumber: { repositoryId, githubNumber } },
    });
  },
};
