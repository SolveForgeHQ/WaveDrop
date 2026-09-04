import type { EmitterWebhookEvent } from "@octokit/webhooks";
import { prisma } from "../db.js";
import { getInstallationOctokit } from "../octokit.js";
import { CLOSES_ISSUE_RE, getPrCutoffDate } from "../constants.js";
import { awardPoints } from "../services/points.js";
/**
 * Handler: pull_request.closed
 *
 * Handles both PR open (link to issue) and PR merge (award points).
 * We process "closed" events and check payload.pull_request.merged.
 */
export async function handlePullRequestClosed(
  event: EmitterWebhookEvent<"pull_request.closed">
) {
  const { pull_request: pr, repository, installation } = event.payload;

  // Only care about merged PRs
  if (!pr.merged) return;
  if (!installation) {
    console.warn("[pr.closed] No installation in payload");
    return;
  }

  const owner  = repository.owner.login;
  const name   = repository.name;
  const octokit = await getInstallationOctokit(installation.id);

  // Find the repository
  const repo = await prisma.repository.findUnique({
    where: { owner_name: { owner, name } },
  });
  if (!repo) return; // not a registered repo

  // Extract referenced issue numbers from PR body
  const body = pr.body ?? "";
  const issueNumbers: number[] = [];
  let match: RegExpExecArray | null;
  CLOSES_ISSUE_RE.lastIndex = 0;
  while ((match = CLOSES_ISSUE_RE.exec(body)) !== null) {
    const num = parseInt(match[1] ?? "0", 10);
    if (num > 0) issueNumbers.push(num);
  }

  if (issueNumbers.length === 0) {
    // No issue references — not a WaveDrop PR
    return;
  }

  // Process each referenced issue
  for (const issueNumber of issueNumbers) {
    await processMergedPR({
      octokit,
      owner,
      repoName:    name,
      repoId:      repo.id,
      pr,
      issueNumber,
    });
  }
}

// ---------------------------------------------------------------------------
// Internal helper — validate + award points for one issue reference
// ---------------------------------------------------------------------------

type OctokitInstance = any;

interface ProcessMergedPRInput {
  octokit:     OctokitInstance;
  owner:       string;
  repoName:    string;
  repoId:      string;
  pr:          EmitterWebhookEvent<"pull_request.closed">["payload"]["pull_request"];
  issueNumber: number;
}

async function processMergedPR(input: ProcessMergedPRInput) {
  const { octokit, owner, repoName, repoId, pr, issueNumber } = input;
  const authorLogin = pr.user.login;

  const postComment = (body: string) =>
    octokit.rest.issues.createComment({
      owner, repo: repoName, issue_number: pr.number, body,
    }).catch((e: unknown) => console.warn("[pr.closed] comment failed:", e));

  // --- Guard 1: issue must be registered and assigned ---
  const issue = await (prisma.issue as any).findUnique({
    where: { repositoryId_githubNumber: { repositoryId: repoId, githubNumber: issueNumber } },
  });

  if (!issue) {
    await postComment(
      `⚠️ PR merged but issue #${issueNumber} is not tagged as a WaveDrop bounty — no points awarded.`
    );
    return;
  }

  if (issue.isClaimed) {
    await postComment(
      `⚠️ Issue #${issueNumber} was already claimed — no points awarded for PR #${pr.number}.`
    );
    return;
  }

  // --- Guard 2: PR author must match the assigned contributor ---
  if (issue.assignedTo && issue.assignedTo !== authorLogin) {
    await postComment(
      `❌ @${authorLogin} — this issue was assigned to @${issue.assignedTo}, not you. No points awarded.\n\n` +
      `If you believe this is an error, please contact a wave maintainer.`
    );
    return;
  }

  if (!issue.assignedTo) {
    await postComment(
      `⚠️ @${authorLogin} — issue #${issueNumber} has no assignee. Please use \`/apply\` on the issue before opening a PR. No points awarded.`
    );
    return;
  }

  // --- Guard 3: PR must not be stale ---
  const cutoff    = getPrCutoffDate();
  const prCreated = new Date(pr.created_at);
  if (prCreated < cutoff) {
    await postComment(
      `❌ PR #${pr.number} was opened before the wave start date (${cutoff.toISOString().slice(0, 10)}) and is considered stale. No points awarded.`
    );
    return;
  }

  // --- Guard 4: CI checks must have passed ---
  const ciPassed = await checkCIPassed(octokit, owner, repoName, pr.head.sha);
  if (!ciPassed) {
    await postComment(
      `❌ PR #${pr.number} was merged but required CI checks did not pass on the head commit. No points awarded.\n\n` +
      `Please ensure all status checks are green before merging a WaveDrop PR.`
    );
    return;
  }

  // --- All guards passed — award points ---
  try {
    const result = await awardPoints({
      repoFullName:     `${owner}/${repoName}`,
      issueNumber,
      prNumber:         pr.number,
      prTitle:          pr.title,
      prUrl:            pr.html_url,
      contributorLogin: authorLogin,
      mergedAt:         new Date(pr.merged_at ?? pr.closed_at ?? Date.now()),
    });

    await postComment(
      `🎉 Congratulations @${authorLogin}! PR #${pr.number} has been verified and you've earned **${result.points} points** for closing issue #${issueNumber}.\n\n` +
      `These points are recorded in wave **${result.wave.name}** and will convert to USDC when the wave closes. 🌊`
    );

    console.info(
      `[pr.closed] Awarded ${result.points} pts to @${authorLogin} ` +
      `for PR #${pr.number} in ${owner}/${repoName}`
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[pr.closed] awardPoints failed: ${msg}`);
    await postComment(
      `⚠️ PR #${pr.number} was merged but WaveDrop encountered an error recording your points: _${msg}_\n\nPlease contact a maintainer.`
    );
  }
}

/**
 * Returns true if all required CI status checks passed on the given commit SHA.
 * If there are no checks at all, we treat it as passed (repo may not use CI).
 */
async function checkCIPassed(
  octokit:  OctokitInstance,
  owner:    string,
  repo:     string,
  sha:      string
): Promise<boolean> {
  try {
    const { data } = await octokit.rest.checks.listForRef({
      owner, repo, ref: sha, filter: "latest",
    });

    const runs = data.check_runs;
    if (runs.length === 0) return true; // no CI configured — allow

    // All completed runs must have conclusion "success" or "skipped" or "neutral"
    const passing = new Set(["success", "skipped", "neutral"]);
    return runs.every(
      (run: { status: string; conclusion: string | null }) => run.status === "completed" && passing.has(run.conclusion ?? "")
    );
  } catch (err) {
    console.warn("[pr.closed] Could not fetch CI checks:", err);
    return true; // fail open — don't block points if GitHub API is unavailable
  }
}
