/**
 * Points service — awards points for a merged PR.
 * Duplicated here (not imported from ../src) so the github-integration
 * package is self-contained and can be deployed independently.
 */
import { prisma } from "../db.js";

export interface AwardPointsInput {
  repoFullName:     string;
  issueNumber:      number;
  prNumber:         number;
  prTitle:          string;
  prUrl:            string;
  contributorLogin: string;
  mergedAt:         Date;
}

export async function awardPoints(input: AwardPointsInput) {
  const [owner, name] = input.repoFullName.split("/") as [string, string];

  const repo = await prisma.repository.findUnique({
    where: { owner_name: { owner, name } },
  });
  if (!repo) throw new Error(`Repository not registered: ${input.repoFullName}`);

  const issue = await prisma.issue.findUnique({
    where: { repositoryId_githubNumber: { repositoryId: repo.id, githubNumber: input.issueNumber } },
  });
  if (!issue)          throw new Error(`Issue #${input.issueNumber} is not tagged in WaveDrop`);
  if (issue.isClaimed) throw new Error(`Issue #${input.issueNumber} is already claimed`);

  const wave = await prisma.wave.findFirst({
    where: { status: "ACTIVE", repositories: { some: { repositoryId: repo.id } } },
  });
  if (!wave) throw new Error(`No active wave for repository ${input.repoFullName}`);

  const contributor = await prisma.contributor.findUnique({
    where: { githubLogin: input.contributorLogin },
  });
  if (!contributor) throw new Error(`Contributor not registered: ${input.contributorLogin}`);

  const existingPr = await prisma.pullRequest.findUnique({
    where: { repositoryId_githubNumber: { repositoryId: repo.id, githubNumber: input.prNumber } },
  });

  const result = await prisma.$transaction(async (tx) => {
    const pr = existingPr
      ? await tx.pullRequest.update({
          where: { id: existingPr.id },
          data:  { status: "MERGED", mergedAt: input.mergedAt },
        })
      : await tx.pullRequest.create({
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
