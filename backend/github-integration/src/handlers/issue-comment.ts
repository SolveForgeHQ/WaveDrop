import type { EmitterWebhookEvent } from "@octokit/webhooks";
import { prisma } from "../db.js";
import { getInstallationOctokit } from "../octokit.js";
import { APPLY_COMMAND, MAX_APPLICATIONS_PER_WAVE } from "../constants.js";

/**
 * Handler: issue_comment.created
 *
 * When a contributor comments "/apply" on an issue:
 *  1. Verify the issue is a registered WaveDrop issue in an active wave.
 *  2. Check the contributor hasn't already applied to this issue.
 *  3. Check they haven't hit the 5-application cap for this wave.
 *  4. Record the application and assign them on GitHub.
 *  5. Post a confirmation comment.
 */
export async function handleIssueComment(
  event: EmitterWebhookEvent<"issue_comment.created">
) {
  const { comment, issue, repository, installation } = event.payload;

  // Only react to /apply command
  if (!comment.body.trim().startsWith(APPLY_COMMAND)) return;
  // Ignore bot comments to prevent loops
  if (comment.user.type === "Bot") return;

  const login  = comment.user.login;
  const owner  = repository.owner.login;
  const name   = repository.name;
  const issueNumber = issue.number;

  if (!installation) {
    console.warn("[issue_comment] No installation in payload — cannot call GitHub API");
    return;
  }

  const octokit = await getInstallationOctokit(installation.id);

  // Find the repository
  const repo = await prisma.repository.findUnique({
    where: { owner_name: { owner, name } },
  });
  if (!repo) {
    await octokit.rest.issues.createComment({
      owner, repo: name, issue_number: issueNumber,
      body: `👋 @${login} — this repository isn't registered with WaveDrop yet.`,
    });
    return;
  }

  // Find the issue
  const wavedropIssue = await prisma.issue.findUnique({
    where: { repositoryId_githubNumber: { repositoryId: repo.id, githubNumber: issueNumber } },
  });
  if (!wavedropIssue) {
    await octokit.rest.issues.createComment({
      owner, repo: name, issue_number: issueNumber,
      body: `👋 @${login} — this issue isn't tagged for a WaveDrop bounty. Ask a maintainer to add a \`wave:100\`, \`wave:150\`, or \`wave:200\` label.`,
    });
    return;
  }

  if (!wavedropIssue.isOpen || wavedropIssue.isClaimed) {
    await octokit.rest.issues.createComment({
      owner, repo: name, issue_number: issueNumber,
      body: `❌ @${login} — this issue is already claimed and no longer available.`,
    });
    return;
  }

  // Find the active wave for this repo
  const wave = await prisma.wave.findFirst({
    where: {
      status:       "ACTIVE",
      repositories: { some: { repositoryId: repo.id } },
    },
  });
  if (!wave) {
    await octokit.rest.issues.createComment({
      owner, repo: name, issue_number: issueNumber,
      body: `👋 @${login} — there's no active wave for this repository right now.`,
    });
    return;
  }

  // Check if already assigned
  if (wavedropIssue.assignedTo) {
    if (wavedropIssue.assignedTo === login) {
      await octokit.rest.issues.createComment({
        owner, repo: name, issue_number: issueNumber,
        body: `✅ @${login} — you're already assigned to this issue!`,
      });
    } else {
      await octokit.rest.issues.createComment({
        owner, repo: name, issue_number: issueNumber,
        body: `❌ @${login} — this issue is already assigned to @${wavedropIssue.assignedTo}.`,
      });
    }
    return;
  }

  // Check the 5-application cap for this wave
  const existingApplications = await prisma.issueApplication.count({
    where: { waveId: wave.id, githubLogin: login },
  });
  if (existingApplications >= MAX_APPLICATIONS_PER_WAVE) {
    await octokit.rest.issues.createComment({
      owner, repo: name, issue_number: issueNumber,
      body: `❌ @${login} — you've reached the maximum of **${MAX_APPLICATIONS_PER_WAVE} issue applications** for this wave. Complete or withdraw an existing one first.`,
    });
    return;
  }

  // Check duplicate application on this specific issue
  const alreadyApplied = await prisma.issueApplication.findUnique({
    where: { issueId_githubLogin: { issueId: wavedropIssue.id, githubLogin: login } },
  });
  if (alreadyApplied) {
    await octokit.rest.issues.createComment({
      owner, repo: name, issue_number: issueNumber,
      body: `✅ @${login} — you've already applied for this issue.`,
    });
    return;
  }

  // Record application + assign in a transaction
  await prisma.$transaction([
    prisma.issueApplication.create({
      data: { issueId: wavedropIssue.id, waveId: wave.id, githubLogin: login },
    }),
    prisma.issue.update({
      where: { id: wavedropIssue.id },
      data:  { assignedTo: login },
    }),
  ]);

  // Assign on GitHub
  try {
    await octokit.rest.issues.addAssignees({
      owner, repo: name, issue_number: issueNumber,
      assignees: [login],
    });
  } catch (err) {
    console.warn(`[issue_comment] Could not assign ${login} on GitHub: ${err}`);
  }

  await octokit.rest.issues.createComment({
    owner, repo: name, issue_number: issueNumber,
    body:
      `🎉 @${login} — you've been assigned this issue! ` +
      `It's worth **${wavedropIssue.points} points**.\n\n` +
      `Open a PR that includes \`Closes #${issueNumber}\` in the description and get it merged before the wave ends. Good luck!`,
  });

  console.info(`[issue_comment] @${login} applied and assigned to issue #${issueNumber} in ${owner}/${name}`);
}
