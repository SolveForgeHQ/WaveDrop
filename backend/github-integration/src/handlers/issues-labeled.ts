import type { EmitterWebhookEvent } from "@octokit/webhooks";
import { prisma } from "../db.js";
import { WAVE_LABEL_MAP } from "../constants.js";

/**
 * Handler: issues.labeled
 *
 * When a maintainer adds a wave:100 / wave:150 / wave:200 label to an issue:
 *  1. Resolve the repository in WaveDrop's DB.
 *  2. Find the active wave that covers this repository.
 *  3. Upsert the issue into the DB with the correct complexity + points.
 */
export async function handleIssueLabeled(
  event: EmitterWebhookEvent<"issues.labeled">
) {
  const { issue, label, repository, installation } = event.payload;
  if (!label) return;

  const labelConfig = WAVE_LABEL_MAP[label.name];
  if (!labelConfig) return; // not a WaveDrop label — ignore

  const owner = repository.owner.login;
  const name  = repository.name;

  // Find the repo record
  const repo = await prisma.repository.findUnique({
    where: { owner_name: { owner, name } },
  });
  if (!repo) {
    console.warn(`[issues.labeled] Repo ${owner}/${name} not registered in WaveDrop — skipping`);
    return;
  }

  // Store installation ID if not already recorded
  if (installation && !repo.installationId) {
    await prisma.repository.update({
      where: { id: repo.id },
      data:  { installationId: String(installation.id) },
    });
  }

  // Find an active wave that includes this repo
  const wave = await prisma.wave.findFirst({
    where: {
      status:       "ACTIVE",
      repositories: { some: { repositoryId: repo.id } },
    },
  });
  if (!wave) {
    console.warn(`[issues.labeled] No active wave for ${owner}/${name} — issue #${issue.number} not synced`);
    return;
  }

  // Upsert the issue
  await prisma.issue.upsert({
    where: {
      repositoryId_githubNumber: {
        repositoryId: repo.id,
        githubNumber: issue.number,
      },
    },
    create: {
      repositoryId: repo.id,
      githubNumber: issue.number,
      title:        issue.title,
      url:          issue.html_url,
      complexity:   labelConfig.complexity,
      points:       labelConfig.points,
      isOpen:       issue.state === "open",
    },
    update: {
      title:      issue.title,
      complexity: labelConfig.complexity,
      points:     labelConfig.points,
    },
  });

  console.info(
    `[issues.labeled] Synced issue #${issue.number} (${labelConfig.points} pts) ` +
    `from ${owner}/${name} into wave "${wave.name}"`
  );
}
