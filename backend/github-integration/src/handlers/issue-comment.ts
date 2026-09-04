import type { EmitterWebhookEvent } from "@octokit/webhooks";
import { prisma } from "../db.js";
import { getInstallationOctokit } from "../octokit.js";
import { APPLY_COMMAND, MAX_APPLICATIONS_PER_WAVE } from "../constants.js";

type OctokitInstance = Awaited<ReturnType<typeof getInstallationOctokit>>;

/**
 * Handler: issue_comment.created
 *
 * Handles two commands:
 *   /apply          — contributor records a pending application (no auto-assign)
 *   /assign @login  — maintainer (write access) assigns an applicant
 */
export async function handleIssueComment(
  event: EmitterWebhookEvent<"issue_comment.created">
) {
  const { comment, issue, repository, installation } = event.payload;
  if (comment.user?.type === "Bot") return; // prevent loops

  const body         = comment.body.trim();
  const commenterLogin = comment.user?.login ?? "";
  if (!commenterLogin) return;

  const owner        = repository.owner?.login ?? "";
  const name         = repository.name;
  const issueNumber  = issue.number;

  if (!installation) {
    console.warn("[issue_comment] No installation in payload");
    return;
  }

  const octokit = (await getInstallationOctokit(installation.id)) as any;

  if (body.startsWith(APPLY_COMMAND)) {
    await handleApply({ octokit, owner, name, issueNumber, login: commenterLogin });
    return;
  }

  // /assign @username — maintainer command
  const assignMatch = body.match(/^\/assign\s+@([\w-]+)/i);
  if (assignMatch?.[1]) {
    const targetLogin = assignMatch[1];
    await handleAssign({ octokit, owner, name, issueNumber, maintainerLogin: commenterLogin, targetLogin });
    return;
  }
}

// ---------------------------------------------------------------------------
// /apply handler
// ---------------------------------------------------------------------------

interface ApplyInput {
  octokit:      any;
  owner:        string;
  name:         string;
  issueNumber:  number;
  login:        string;
}

async function handleApply({ octokit, owner, name, issueNumber, login }: ApplyInput) {
  const post = (body: string) =>
    octokit.rest.issues.createComment({ owner, repo: name, issue_number: issueNumber, body });

  const repo = await prisma.repository.findUnique({
    where: { owner_name: { owner, name } },
  });
  if (!repo) {
    await post(`👋 @${login} — this repository isn't registered with WaveDrop yet.`);
    return;
  }

  const wavedropIssue = await (prisma.issue as any).findUnique({
    where: { repositoryId_githubNumber: { repositoryId: repo.id, githubNumber: issueNumber } },
    include: { _count: { select: { applications: true } } },
  });
  if (!wavedropIssue) {
    await post(
      `👋 @${login} — this issue isn't tagged for a WaveDrop bounty. ` +
      `Ask a maintainer to add a \`wave:100\`, \`wave:150\`, or \`wave:200\` label.`
    );
    return;
  }
  if (!wavedropIssue.isOpen || wavedropIssue.isClaimed) {
    await post(`❌ @${login} — this issue is already claimed and no longer available.`);
    return;
  }

  const wave = await prisma.wave.findFirst({
    where: { status: "ACTIVE", repositories: { some: { repositoryId: repo.id } } },
  });
  if (!wave) {
    await post(`👋 @${login} — there's no active wave for this repository right now.`);
    return;
  }

  // Already applied to this specific issue?
  const alreadyApplied = await (prisma as any).issueApplication?.findUnique({
    where: { issueId_githubLogin: { issueId: wavedropIssue.id, githubLogin: login } },
  });
  if (alreadyApplied) {
    await post(`✅ @${login} — you've already applied for this issue. A maintainer will review applications.`);
    return;
  }

  // Hit the 5-application cap?
  const waveApplicationCount = await (prisma as any).issueApplication?.count({
    where: { waveId: wave.id, githubLogin: login },
  }) ?? 0;
  if (waveApplicationCount >= MAX_APPLICATIONS_PER_WAVE) {
    await post(
      `❌ @${login} — you've reached the maximum of **${MAX_APPLICATIONS_PER_WAVE} applications** ` +
      `for this wave. Complete or withdraw an existing one first.`
    );
    return;
  }

  // Record the pending application — NO assignment yet
  if ((prisma as any).issueApplication) {
    await (prisma as any).issueApplication.create({
      data: { issueId: wavedropIssue.id, waveId: wave.id, githubLogin: login },
    });
  }

  const totalApplicants = (wavedropIssue._count?.applications ?? 0) + 1;

  // Find repo maintainer logins from the wave ecosystem to tag
  const ecosystem = await (prisma.repository as any).findUnique({
    where: { id: repo.id },
    select: { ecosystem: { select: { githubOrg: true } } },
  });
  const maintainerTag = ecosystem?.ecosystem?.githubOrg
    ? `@${ecosystem.ecosystem.githubOrg}`
    : "maintainers";

  await post(
    `📝 **${totalApplicants} contributor${totalApplicants === 1 ? "" : "s"} applied** for this issue.\n\n` +
    `@${login} has submitted an application — it's worth **${wavedropIssue.points} points**.\n\n` +
    `${maintainerTag} — to assign this contributor, comment:\n` +
    `\`\`\`\n/assign @${login}\n\`\`\``
  );

  console.info(`[/apply] @${login} applied to issue #${issueNumber} in ${owner}/${name} (pending maintainer approval)`);
}

// ---------------------------------------------------------------------------
// /assign @username handler
// ---------------------------------------------------------------------------

interface AssignInput {
  octokit:          any;
  owner:            string;
  name:             string;
  issueNumber:      number;
  maintainerLogin:  string;
  targetLogin:      string;
}

async function handleAssign({
  octokit, owner, name, issueNumber, maintainerLogin, targetLogin,
}: AssignInput) {
  const post = (body: string) =>
    octokit.rest.issues.createComment({ owner, repo: name, issue_number: issueNumber, body });

  // Verify the commenter has write access (is a maintainer/collaborator)
  let hasWriteAccess = false;
  try {
    const { data: perm } = await octokit.rest.repos.getCollaboratorPermissionLevel({
      owner, repo: name, username: maintainerLogin,
    });
    hasWriteAccess = ["admin", "maintain", "write"].includes(perm.permission);
  } catch {
    hasWriteAccess = false;
  }

  if (!hasWriteAccess) {
    await post(
      `❌ @${maintainerLogin} — only repository maintainers can assign contributors. ` +
      `Contributors should use \`/apply\` to express interest.`
    );
    return;
  }

  const repo = await prisma.repository.findUnique({
    where: { owner_name: { owner, name } },
  });
  if (!repo) {
    await post(`⚠️ This repository isn't registered with WaveDrop.`);
    return;
  }

  const wavedropIssue = await (prisma.issue as any).findUnique({
    where: { repositoryId_githubNumber: { repositoryId: repo.id, githubNumber: issueNumber } },
  });
  if (!wavedropIssue) {
    await post(`⚠️ This issue isn't tagged as a WaveDrop bounty.`);
    return;
  }
  if (!wavedropIssue.isOpen || wavedropIssue.isClaimed) {
    await post(`❌ This issue is already claimed and cannot be reassigned.`);
    return;
  }

  // Target must have applied first
  const application = await (prisma as any).issueApplication?.findUnique({
    where: { issueId_githubLogin: { issueId: wavedropIssue.id, githubLogin: targetLogin } },
  });
  if (!application) {
    await post(
      `❌ @${targetLogin} hasn't applied for this issue yet.\n\n` +
      `They need to comment \`/apply\` on this issue before you can assign them.`
    );
    return;
  }

  // Already assigned?
  if (wavedropIssue.assignedTo === targetLogin) {
    await post(`✅ @${targetLogin} is already assigned to this issue.`);
    return;
  }

  // Perform the assignment
  await (prisma.issue as any).update({
    where: { id: wavedropIssue.id },
    data:  { assignedTo: targetLogin },
  });

  try {
    await octokit.rest.issues.addAssignees({
      owner, repo: name, issue_number: issueNumber,
      assignees: [targetLogin],
    });
  } catch (err) {
    console.warn(`[/assign] Could not set GitHub assignee: ${err}`);
  }

  await post(
    `✅ @${targetLogin} has been assigned this issue by @${maintainerLogin}!\n\n` +
    `This issue is worth **${wavedropIssue.points} points**. Open a PR with ` +
    `\`Closes #${issueNumber}\` in the description and get it merged before the wave ends. Good luck! 🌊`
  );

  console.info(`[/assign] @${maintainerLogin} assigned @${targetLogin} to issue #${issueNumber} in ${owner}/${name}`);
}
