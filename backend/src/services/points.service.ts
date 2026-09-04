import { prisma } from "../db/prisma.js";
import { contributorRepo } from "../repositories/contributor.repo.js";
import { issueRepo } from "../repositories/issue.repo.js";

export interface AwardPointsInput {
  /** GitHub repo full name, e.g. "org/repo" */
  repoFullName:  string;
  /** GitHub issue number that this PR closes */
  issueNumber:   number;
  /** GitHub PR number */
  prNumber:      number;
  prTitle:       string;
  prUrl:         string;
  /** GitHub login of the PR author */
  contributorLogin: string;
  mergedAt:      Date;
}

/**
 * Award points for a merged PR that resolves a tagged issue.
 *
 * Guards:
 *  - Issue must exist and be tagged with a point value.
 *  - Issue must not already be claimed (prevents double-award).
 *  - Contributor must exist (created during OAuth login).
 *  - A matching ACTIVE wave must cover this repository.
 *  - Duplicate PRs for the same issue are rejected.
 */
export async function awardPoints(input: AwardPointsInput) {
  const [owner, name] = input.repoFullName.split("/") as [string, string];

  // Find the repository
  const repo = await prisma.repository.findUnique({
    where: { owner_name: { owner, name } },
  });
  if (!repo) throw new Error(`Repository not registered: ${input.repoFullName}`);

  // Find the tagged issue
  const issue = await issueRepo.findByRepoAndNumber(repo.id, input.issueNumber);
  if (!issue) throw new Error(`Issue #${input.issueNumber} is not tagged in WaveDrop`);
  if (issue.isClaimed) throw new Error(`Issue #${input.issueNumber} is already claimed`);

  // Find an ACTIVE wave that covers this repository
  const wave = await prisma.wave.findFirst({
    where: {
      status:       "ACTIVE",
      repositories: { some: { repositoryId: repo.id } },
    },
  });
  if (!wave) throw new Error(`No active wave for repository ${input.repoFullName}`);

  // Find or fail the contributor
  const contributor = await contributorRepo.findByLogin(input.contributorLogin);
  if (!contributor) throw new Error(`Contributor not registered: ${input.contributorLogin}`);

  // Check for duplicate PR entry
  const existingPr = await prisma.pullRequest.findUnique({
    where: { repositoryId_githubNumber: { repositoryId: repo.id, githubNumber: input.prNumber } },
  });
  if (existingPr) throw new Error(`PR #${input.prNumber} already recorded`);

  // Write PR + ledger entry atomically using an interactive transaction
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await prisma.$transaction(async (tx: any) => {
    const pr = await tx.pullRequest.create({
      data: {
        issueId:       issue.id,
        contributorId: contributor.id,
        repositoryId:  repo.id,
        githubNumber:  input.prNumber,
        title:         input.prTitle,
        url:           input.prUrl,
        status:        "MERGED",
        mergedAt:      input.mergedAt,
      },
    });

    const ledgerEntry = await tx.pointsLedger.create({
      data: {
        waveId:        wave.id,
        contributorId: contributor.id,
        pullRequestId: pr.id,
        points:        issue.points,
        reason:        `Merged PR #${input.prNumber}: ${input.prTitle}`,
      },
    });

    await tx.issue.update({
      where: { id: issue.id },
      data:  { isClaimed: true, isOpen: false },
    });

    return { pr, ledgerEntry };
  });

  return { ...result, points: issue.points, wave };
}

/**
 * Get total points per contributor for a wave, ordered descending.
 */
export async function getLeaderboard(waveId: string, page = 1, pageSize = 20) {
  const skip = (page - 1) * pageSize;

  const totals = await prisma.pointsLedger.groupBy({
    by:      ["contributorId"],
    where:   { waveId },
    _sum:    { points: true },
    orderBy: { _sum: { points: "desc" } },
    skip,
    take:    pageSize,
  });

  const total = await prisma.pointsLedger.groupBy({
    by:    ["contributorId"],
    where: { waveId },
  });

  // Enrich with contributor info
  const contributors = await prisma.contributor.findMany({
    where:  { id: { in: totals.map((t: { contributorId: string }) => t.contributorId) } },
    select: { id: true, githubLogin: true, avatarUrl: true, walletAddress: true },
  });

  const contributorMap = new Map(contributors.map((c: { id: string; githubLogin: string; avatarUrl: string | null; walletAddress: string | null }) => [c.id, c]));

  const entries = totals.map((t: { contributorId: string; _sum: { points: number | null } }, i: number) => ({
    rank:        skip + i + 1,
    contributor: contributorMap.get(t.contributorId),
    totalPoints: t._sum.points ?? 0,
  }));

  return { entries, total: total.length, page, pageSize };
}
