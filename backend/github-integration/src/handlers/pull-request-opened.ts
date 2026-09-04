import type { EmitterWebhookEvent } from "@octokit/webhooks";
import { prisma } from "../db.js";
import { getInstallationOctokit } from "../octokit.js";
import { CLOSES_ISSUE_RE } from "../constants.js";

/**
 * Handler: pull_request.opened
 *
 * When a PR is opened that references an assigned issue via "Closes #N":
 *  1. Find the referenced issue in our DB.
 *  2. Create or update the PullRequest record linking it to the issue.
 *  3. Post a status comment letting the contributor know we've tracked it.
 */
export async function handlePullRequestOpened(
  event: EmitterWebhookEvent<"pull_request.opened">
) {
  const { pull_request: pr, repository, installation } = event.payload;
  if (!installation) return;

  const owner     = repository.owner.login;
  const name      = repository.name;
  const authorLogin = pr.user.login;

  const repo = await prisma.repository.findUnique({
    where: { owner_name: { owner, name } },
  });
  if (!repo) return;

  const body = pr.body ?? "";
  const issueNumbers: number[] = [];
  let match: RegExpExecArray | null;
  CLOSES_ISSUE_RE.lastIndex = 0;
  while ((match = CLOSES_ISSUE_RE.exec(body)) !== null) {
    const num = parseInt(match[1] ?? "0", 10);
    if (num > 0) issueNumbers.push(num);
  }
  if (issueNumbers.length === 0) return;

  const octokit = (await getInstallationOctokit(installation.id)) as any;

  for (const issueNumber of issueNumbers) {
    const issue = await (prisma.issue as any).findUnique({
      where: { repositoryId_githubNumber: { repositoryId: repo.id, githubNumber: issueNumber } },
    });
    if (!issue) continue;

    // Look up the contributor
    const contributor = await prisma.contributor.findUnique({
      where: { githubLogin: authorLogin },
    });
    if (!contributor) {
      await octokit.rest.issues.createComment({
        owner, repo: name, issue_number: pr.number,
        body: `👋 @${authorLogin} — your GitHub account isn't registered with WaveDrop yet. Please sign in at the WaveDrop app and link your wallet to be eligible for points.`,
      });
      continue;
    }

    // Upsert the PR record
    await prisma.pullRequest.upsert({
      where: {
        repositoryId_githubNumber: { repositoryId: repo.id, githubNumber: pr.number },
      },
      create: {
        issueId:       issue.id,
        contributorId: contributor.id,
        repositoryId:  repo.id,
        githubNumber:  pr.number,
        title:         pr.title,
        url:           pr.html_url,
        status:        "OPEN",
      },
      update: {
        title:  pr.title,
        status: "OPEN",
      },
    });

    // Validate assignment before posting
    if (issue.assignedTo && issue.assignedTo !== authorLogin) {
      await octokit.rest.issues.createComment({
        owner, repo: name, issue_number: pr.number,
        body:
          `⚠️ @${authorLogin} — issue #${issueNumber} is assigned to @${issue.assignedTo}, not you.\n\n` +
          `This PR has been recorded but **will not earn points** unless you are the assigned contributor. ` +
          `Contact a maintainer if you think there's an error.`,
      });
      continue;
    }

    await octokit.rest.issues.createComment({
      owner, repo: name, issue_number: pr.number,
      body:
        `✅ WaveDrop has linked this PR to issue #${issueNumber} (**${issue.points} points**).\n\n` +
        `Once this PR is merged and CI passes, your points will be automatically credited. 🌊`,
    });
  }
}
