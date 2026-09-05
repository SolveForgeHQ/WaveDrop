import { PrismaClient } from "@prisma/client";
import { PrismaPg }    from "@prisma/adapter-pg";
import pg               from "pg";

/**
 * WaveDrop Database Seed
 * ──────────────────────
 * Populates the database with realistic sample data so contributors can
 * explore the app locally without needing a live GitHub webhook or
 * real OAuth credentials.
 *
 * Usage:
 *   cd backend
 *   pnpm db:seed
 */

const pool    = new pg.Pool({ connectionString: process.env["DATABASE_URL"]! });
const adapter = new PrismaPg(pool);
const prisma  = new PrismaClient({ adapter });

async function main() {
  console.log("🌱  Seeding WaveDrop database...\n");

  // ── 1. Ecosystem ──────────────────────────────────────────────────────────
  const ecosystem = await prisma.ecosystem.upsert({
    where:  { id: "seed-ecosystem-1" },
    update: {},
    create: {
      id:          "seed-ecosystem-1",
      name:        "SolveForge",
      description: "Open-source tooling for the Stellar ecosystem, funded by SolveForgeHQ.",
      logoUrl:     "https://avatars.githubusercontent.com/u/solveforgehq",
      githubOrg:   "SolveForgeHQ",
    },
  });
  console.log(`✅  Ecosystem: ${ecosystem.name}`);

  // ── 2. Repository ─────────────────────────────────────────────────────────
  const repo = await prisma.repository.upsert({
    where:  { owner_name: { owner: "SolveForgeHQ", name: "WaveDrop" } },
    update: {},
    create: {
      id:          "seed-repo-1",
      ecosystemId: ecosystem.id,
      owner:       "SolveForgeHQ",
      name:        "WaveDrop",
    },
  });
  console.log(`✅  Repository: ${repo.owner}/${repo.name}`);

  // ── 3. Wave ───────────────────────────────────────────────────────────────
  const now       = new Date();
  const twoWeeks  = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const wave = await prisma.wave.upsert({
    where:  { id: "seed-wave-1" },
    update: {},
    create: {
      id:             "seed-wave-1",
      ecosystemId:    ecosystem.id,
      name:           "Wave 1 — Foundation",
      description:    "Initial open-source bounty wave covering core infrastructure improvements.",
      status:         "ACTIVE",
      poolAmountUsdc: "5000.00",
      startsAt:       now,
      endsAt:         twoWeeks,
    },
  });
  console.log(`✅  Wave: ${wave.name}  ($${wave.poolAmountUsdc} USDC pool)`);

  // Link repo to wave
  await prisma.waveRepo.upsert({
    where:  { waveId_repositoryId: { waveId: wave.id, repositoryId: repo.id } },
    update: {},
    create: { waveId: wave.id, repositoryId: repo.id },
  });

  // ── 4. Issues ─────────────────────────────────────────────────────────────
  const issueSeeds = [
    {
      id:           "seed-issue-1",
      githubNumber: 1,
      title:        "Add Stellar wallet connection to the frontend",
      url:          "https://github.com/SolveForgeHQ/WaveDrop/issues/1",
      complexity:   "HARD"  as const,
      points:       200,
    },
    {
      id:           "seed-issue-2",
      githubNumber: 2,
      title:        "Write Soroban Merkle distributor contract",
      url:          "https://github.com/SolveForgeHQ/WaveDrop/issues/2",
      complexity:   "HARD"  as const,
      points:       200,
    },
    {
      id:           "seed-issue-3",
      githubNumber: 3,
      title:        "Add Docker Compose setup for local development",
      url:          "https://github.com/SolveForgeHQ/WaveDrop/issues/3",
      complexity:   "EASY"  as const,
      points:       100,
    },
    {
      id:           "seed-issue-4",
      githubNumber: 4,
      title:        "Improve leaderboard pagination and sorting",
      url:          "https://github.com/SolveForgeHQ/WaveDrop/issues/4",
      complexity:   "MEDIUM" as const,
      points:       150,
    },
    {
      id:           "seed-issue-5",
      githubNumber: 5,
      title:        "Write unit tests for points calculation service",
      url:          "https://github.com/SolveForgeHQ/WaveDrop/issues/5",
      complexity:   "MEDIUM" as const,
      points:       150,
    },
  ];

  for (const seed of issueSeeds) {
    await prisma.issue.upsert({
      where:  { repositoryId_githubNumber: { repositoryId: repo.id, githubNumber: seed.githubNumber } },
      update: {},
      create: { ...seed, repositoryId: repo.id },
    });
  }
  console.log(`✅  Issues: seeded ${issueSeeds.length} open bounty issues`);

  // ── 5. Contributors ───────────────────────────────────────────────────────
  const contributors = [
    {
      id:           "seed-contributor-1",
      githubId:     1001,
      githubLogin:  "alice-dev",
      githubEmail:  "alice@example.com",
      avatarUrl:    "https://avatars.githubusercontent.com/u/1001",
      walletAddress: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    },
    {
      id:           "seed-contributor-2",
      githubId:     1002,
      githubLogin:  "bob-builder",
      githubEmail:  "bob@example.com",
      avatarUrl:    "https://avatars.githubusercontent.com/u/1002",
      walletAddress: null,
    },
    {
      id:           "seed-contributor-3",
      githubId:     1003,
      githubLogin:  "carol-codes",
      githubEmail:  "carol@example.com",
      avatarUrl:    "https://avatars.githubusercontent.com/u/1003",
      walletAddress: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    },
  ];

  for (const c of contributors) {
    await prisma.contributor.upsert({
      where:  { githubId: c.githubId },
      update: {},
      create: c,
    });
  }
  console.log(`✅  Contributors: seeded ${contributors.length} sample contributors`);

  // ── 6. Pull Requests + Points Ledger ─────────────────────────────────────
  // alice merged PR for issue #3 (easy, 100 pts) and #4 (medium, 150 pts)
  // carol merged PR for issue #5 (medium, 150 pts)
  const prSeeds = [
    {
      pr: {
        id: "seed-pr-1", issueId: "seed-issue-3", contributorId: "seed-contributor-1",
        repositoryId: repo.id, githubNumber: 10, title: "feat: add docker-compose for local dev",
        url: "https://github.com/SolveForgeHQ/WaveDrop/pull/10",
        status: "MERGED" as const, mergedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      points: 100,
    },
    {
      pr: {
        id: "seed-pr-2", issueId: "seed-issue-4", contributorId: "seed-contributor-1",
        repositoryId: repo.id, githubNumber: 11, title: "feat: improve leaderboard pagination",
        url: "https://github.com/SolveForgeHQ/WaveDrop/pull/11",
        status: "MERGED" as const, mergedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
      points: 150,
    },
    {
      pr: {
        id: "seed-pr-3", issueId: "seed-issue-5", contributorId: "seed-contributor-3",
        repositoryId: repo.id, githubNumber: 12, title: "test: add points service unit tests",
        url: "https://github.com/SolveForgeHQ/WaveDrop/pull/12",
        status: "MERGED" as const, mergedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      },
      points: 150,
    },
  ];

  for (const { pr, points } of prSeeds) {
    await prisma.pullRequest.upsert({
      where:  { repositoryId_githubNumber: { repositoryId: repo.id, githubNumber: pr.githubNumber } },
      update: {},
      create: pr,
    });

    await prisma.pointsLedger.upsert({
      where:  { pullRequestId: pr.id },
      update: {},
      create: {
        id:            `seed-ledger-${pr.id}`,
        waveId:        wave.id,
        contributorId: pr.contributorId,
        pullRequestId: pr.id,
        points,
        reason:        `Merged PR #${pr.githubNumber}: ${pr.title}`,
      },
    });

    // Mark issue as claimed
    await prisma.issue.update({
      where: { id: pr.issueId },
      data:  { isClaimed: true, isOpen: false },
    });
  }
  console.log(`✅  Pull Requests + Points Ledger: seeded ${prSeeds.length} merged PRs`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n🎉  Seed complete! Summary:");
  console.log(`    • 1 Ecosystem  (SolveForge)`);
  console.log(`    • 1 Wave       (Wave 1 — Foundation, $5,000 USDC pool)`);
  console.log(`    • 1 Repository (SolveForgeHQ/WaveDrop)`);
  console.log(`    • ${issueSeeds.length} Issues     (2 open, 3 claimed)`);
  console.log(`    • ${contributors.length} Contributors (alice: 250 pts, carol: 150 pts, bob: 0 pts)`);
  console.log("\n  Login as any contributor via GitHub OAuth to explore the app.\n");
}

main()
  .catch((err) => {
    console.error("❌  Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
