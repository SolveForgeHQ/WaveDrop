# WaveDrop — Full Architecture Guide

This document explains how every part of WaveDrop works, how the pieces depend
on each other, and how many processes you need to run locally.

---

## Table of Contents

1. [What WaveDrop Does](#what-wavedrop-does)
2. [Monorepo Structure](#monorepo-structure)
3. [Package Dependency Map](#package-dependency-map)
4. [Layer 1 — Contracts (Solidity / Foundry)](#layer-1--contracts)
5. [Layer 2 — Shared Types](#layer-2--shared-types)
6. [Layer 3 — Backend API](#layer-3--backend-api)
7. [Layer 4 — GitHub Integration](#layer-4--github-integration)
8. [Layer 5 — Frontend](#layer-5--frontend)
9. [Database (Neon / PostgreSQL)](#database)
10. [How a Full Wave Lifecycle Works](#how-a-full-wave-lifecycle-works)
11. [Running Locally — How Many Servers?](#running-locally)
12. [Environment Variables Explained](#environment-variables-explained)

---

## What WaveDrop Does

WaveDrop is a **recurring contribution-bounty platform** built on Avalanche.

The loop looks like this:

```
Ecosystem partner funds a Wave (pool of USDC)
        ↓
Contributors browse GitHub issues tagged with point values
        ↓
Contributor applies with /apply comment → gets assigned
        ↓
Contributor opens a PR that closes the issue
        ↓
PR is merged → bot verifies and awards points off-chain
        ↓
Wave closes → backend builds a Merkle tree
        ↓
Operator submits the Merkle root on-chain
        ↓
Contributors call claim() on the smart contract to receive USDC
```

**Key design principle:** Points and leaderboard data live entirely in Postgres
(fast, free, zero gas). Only the final settlement is on-chain — a single Merkle
root per wave. Contributors claim USDC by submitting a cryptographic proof
(Merkle proof) to the contract. This is the same pattern used by Uniswap's
merkle-distributor.

---

## Monorepo Structure

```
wavedrop/
├── pnpm-workspace.yaml         ← tells pnpm which folders are packages
├── package.json                ← root scripts (build all, lint all)
│
├── shared/                     ← @wavedrop/shared
│   └── src/
│       ├── types/entities.ts   ← TypeScript types for all DB entities
│       ├── types/api.ts        ← API request/response shapes
│       ├── constants/chains.ts ← Avalanche chain IDs, USDC address
│       └── constants/points.ts ← point tier constants
│
├── contracts/                  ← Solidity (Foundry) — no package.json
│   ├── src/
│   │   ├── WaveRegistry.sol    ← tracks wave metadata on-chain
│   │   ├── WaveEscrow.sol      ← holds USDC for one wave
│   │   ├── MerkleClaim.sol     ← verifies proofs, pays out USDC
│   │   └── MockERC20.sol       ← fake USDC for Fuji testnet
│   ├── test/WaveDrop.t.sol     ← 32 Foundry tests
│   ├── script/Deploy.s.sol     ← deployment script
│   └── foundry.toml            ← compiler + RPC config
│
├── backend/                    ← @wavedrop/backend
│   ├── prisma/
│   │   ├── schema.prisma       ← all DB tables defined here
│   │   └── migrations/         ← auto-generated SQL migration files
│   ├── prisma.config.ts        ← Prisma 7 config (connection URL)
│   ├── src/
│   │   ├── index.ts            ← Fastify server entry point
│   │   ├── db/prisma.ts        ← singleton database client
│   │   ├── plugins/auth.ts     ← GitHub OAuth + session middleware
│   │   ├── repositories/       ← database query functions only
│   │   │   ├── contributor.repo.ts
│   │   │   ├── wave.repo.ts
│   │   │   ├── issue.repo.ts
│   │   │   └── payout.repo.ts
│   │   ├── services/           ← business logic
│   │   │   ├── auth.service.ts     ← GitHub login, wallet validation
│   │   │   ├── wave.service.ts     ← create/close waves, add repos
│   │   │   ├── points.service.ts   ← award points, leaderboard
│   │   │   └── merkle.service.ts   ← build Merkle tree, store proofs
│   │   └── routes/             ← HTTP route handlers
│   │       ├── auth.ts             ← /auth/github, /auth/me, /auth/wallet
│   │       ├── waves.ts            ← /waves, /waves/:id/close
│   │       ├── issues.ts           ← /waves/:id/issues
│   │       ├── leaderboard.ts      ← /waves/:id/leaderboard
│   │       ├── claims.ts           ← /waves/:id/claim/:address
│   │       └── contributors.ts     ← /contributors/:login
│   └── github-integration/     ← @wavedrop/github-integration
│       └── src/
│           ├── index.ts            ← webhook server entry point
│           ├── db.ts               ← own DB client
│           ├── octokit.ts          ← GitHub App authentication
│           ├── constants.ts        ← label names, /apply command
│           ├── handlers/
│           │   ├── issues-labeled.ts       ← sync issue on wave:N label
│           │   ├── issue-comment.ts        ← handle /apply command
│           │   ├── pull-request-opened.ts  ← link PR to issue
│           │   └── pull-request.ts         ← verify merge + award points
│           └── services/points.ts          ← award points logic
│
└── frontend/                   ← Next.js app
    └── src/
        ├── app/                ← Next.js App Router pages
        ├── components/         ← React components
        ├── config/wagmi.ts     ← Avalanche wallet config
        └── lib/api.ts          ← typed fetch wrapper for backend API
```

---

## Package Dependency Map

```
                    ┌─────────────────────┐
                    │   @wavedrop/shared  │
                    │  (types/constants)  │
                    └──────────┬──────────┘
                               │  used by
               ┌───────────────┼───────────────┐
               ↓               ↓               ↓
    ┌──────────────────┐  ┌─────────┐  ┌─────────────┐
    │ @wavedrop/backend│  │frontend │  │  contracts  │
    │  (Fastify API)   │  │(Next.js)│  │  (Foundry)  │
    └──────────────────┘  └─────────┘  └─────────────┘
               │
               │  shares Prisma DB client
               ↓
    ┌──────────────────────────────┐
    │  @wavedrop/github-integration│
    │    (Webhook / Bot server)    │
    └──────────────────────────────┘
               │
               ↓
    ┌──────────────────┐
    │  Neon PostgreSQL │
    │   (shared DB)    │
    └──────────────────┘
```

`shared` is a pure TypeScript package — no runtime, just types and constants.
Both `backend` and `frontend` import from it via `workspace:*` (pnpm's way of
saying "use the local version").

`github-integration` is a sub-package inside `backend/` — it shares the same
Prisma schema and writes to the same Neon database, but runs as its own process
on a different port.

---

## Layer 1 — Contracts

**Location:** `/contracts`
**Tool:** Foundry (forge)
**Language:** Solidity 0.8.24

The contracts only handle money movement — everything else is off-chain.

### WaveRegistry.sol

Think of this as the on-chain "source of truth" for what waves exist. It stores:
- Wave IDs and their status (PENDING → OPEN → CLOSED → SETTLED)
- Which escrow contract belongs to which wave
- Which ecosystem owns which wave

Only the **operator** (backend signer) can transition wave states. The operator
role is granted at deployment — it's a backend wallet address, not a user.

### WaveEscrow.sol

One contract deployed per wave. Ecosystem partners send USDC here.

```
Ecosystem partner → fund(amount) → WaveEscrow holds USDC
Operator         → close()       → no more deposits
Operator         → approveForSettlement(MerkleClaim, amount)
                                 → MerkleClaim can pull the USDC
```

Why one per wave? So the pool for Wave 1 is completely isolated from Wave 2.
There's no risk of Wave 2's funds being accidentally distributed with Wave 1's
Merkle tree.

### MerkleClaim.sol

The payout contract. Handles all waves in a single deployment (no redeployment
per wave — the waveId is a mapping key).

```
Operator → submitRoot(waveId, merkleRoot, escrow, token, amount)
         → pulls USDC from WaveEscrow into MerkleClaim

Contributor → claim(waveId, amount, merkleProof)
            → verifies the proof against the root
            → transfers USDC to contributor
            → marks as claimed (prevents double-claim)
```

**Leaf encoding (critical — must match backend):**
```
leaf = keccak256(abi.encodePacked(address, uint256))
```
20 bytes for address + 32 bytes for amount, concatenated then hashed. The
backend uses the same encoding when building the Merkle tree.

### MockERC20.sol

A simple ERC-20 with a public `mint()` function. Used as fake USDC on Fuji
testnet so you don't need real money to test.

---

## Layer 2 — Shared Types

**Location:** `/shared`
**Package name:** `@wavedrop/shared`

Pure TypeScript — no runtime dependencies. Contains:

- **Entity types** (`types/entities.ts`) — TypeScript interfaces for Ecosystem,
  Wave, Repository, Issue, Contributor, PullRequest, PointsLedger, Payout,
  MerkleClaim. These mirror the Prisma schema so both frontend and backend agree
  on the shape of data.

- **API types** (`types/api.ts`) — Request/response shapes for the HTTP API.
  The frontend imports these to get type safety when calling the backend.

- **Chain constants** (`constants/chains.ts`) — Avalanche chain IDs,
  RPC URLs, and the mainnet USDC address. Imported by both backend (for
  on-chain calls) and frontend (for wagmi config).

- **Point constants** (`constants/points.ts`) — The XS/S/M/L/XL tier system
  and the GitHub label prefix `wavedrop:`.

---

## Layer 3 — Backend API

**Location:** `/backend/src`
**Package name:** `@wavedrop/backend`
**Port:** 4000
**Framework:** Fastify v5

This is the main API server. It handles everything except GitHub webhooks.

### How requests flow

```
HTTP Request
    ↓
Fastify route handler (routes/)
    ↓
Service (services/)           ← business logic lives here
    ↓
Repository (repositories/)    ← only place that touches the DB
    ↓
Prisma Client → Neon PostgreSQL
```

This separation means: routes don't know SQL, services don't know HTTP.

### Auth plugin (`plugins/auth.ts`)

Registers three Fastify plugins:
- `@fastify/cookie` — reads/writes HTTP cookies
- `@fastify/session` — server-side session storage (session ID in cookie,
  data in memory)
- `@fastify/oauth2` — handles the GitHub OAuth dance

Two route guards are exported:
- `requireAuth` — blocks unauthenticated requests with 401
- `requireAdmin` — checks the GitHub login is in `ADMIN_GITHUB_LOGINS` env var

### Services breakdown

| Service | What it does |
|---|---|
| `auth.service.ts` | Calls GitHub API to get user info, upserts Contributor, validates+checksums wallet addresses using ethers.js |
| `wave.service.ts` | Creates waves, adds repos+issues, closes waves |
| `points.service.ts` | Awards points atomically (PR + ledger entry in one DB transaction), calculates leaderboard |
| `merkle.service.ts` | At wave close: aggregates points → calculates USDC share → builds Merkle tree → stores proofs per contributor → returns root |

### Merkle tree generation (the clever part)

When `POST /waves/:id/close` is called:

1. All `PointsLedger` entries for the wave are summed per contributor
2. Each contributor's USDC share = `(their points / total points) × pool size`
3. A Merkle tree is built where each leaf is `keccak256(address + amount)`
4. The tree is built with `sortPairs: true` — this **must** match OZ's
   `commutativeKeccak256` which the contract uses
5. Each contributor's proof is stored in the `Payout` table
6. The root is stored on the `Wave` record

Later, `GET /waves/:id/claim/:address` returns the proof — the frontend uses
this to call `MerkleClaim.claim()` directly from the user's wallet.

### Database access pattern

Repositories only do CRUD. Services contain all the "should this be allowed"
logic. Example:

```
// BAD — business logic in repo
issueRepo.claimIfNotAlreadyClaimed(id)

// GOOD — business logic in service
const issue = await issueRepo.findByRepoAndNumber(...)
if (issue.isClaimed) throw new Error("Already claimed")
await issueRepo.markClaimed(issue.id)
```

---

## Layer 4 — GitHub Integration

**Location:** `/backend/github-integration`
**Package name:** `@wavedrop/github-integration`
**Port:** 4001
**Framework:** Fastify (for webhook endpoint)

This is a separate process from the main API. It listens for GitHub webhook
events and drives the bot behaviour.

### Why separate from the main API?

- Webhooks need raw body access for HMAC signature verification. Mixing this
  with a normal JSON API is messy.
- It can be deployed on a different machine or scaled independently.
- If the webhook handler crashes it doesn't take down the API.

### Webhook security

Every request hits this check first:

```
HMAC-SHA256(secret, rawBody) === X-Hub-Signature-256 header
```

Uses `timingSafeEqual` to prevent timing attacks. If the signature doesn't
match, the request is rejected with 401 immediately — no handler runs.

### Event handlers

**`issues.labeled`** — Triggered when a maintainer adds `wave:100`, `wave:150`,
or `wave:200` to a GitHub issue. The handler:
1. Checks the repo is registered in WaveDrop
2. Finds the active wave covering that repo
3. Upserts the issue into Postgres with the correct complexity + point value

**`issue_comment.created`** — Triggered on every new comment. The handler:
1. Ignores everything except `/apply` (exact start of comment)
2. Ignores bot accounts
3. Checks: is the issue a WaveDrop bounty? Is there an active wave? Is it
   already assigned? Has the commenter hit the 5-application cap?
4. If all checks pass: records in `IssueApplication` table, sets
   `issue.assignedTo`, calls GitHub API to add the assignee, posts a
   confirmation comment

**`pull_request.opened`** — Links the PR to the issue in our DB as soon as it's
opened (before merge). Posts a warning if the PR author isn't the assigned
contributor.

**`pull_request.closed`** — The main event. Only runs if `pr.merged === true`.
Guards run in order:
1. Issue must exist and be unclaimed
2. PR author must match `issue.assignedTo`
3. PR created_at must be after the `PR_CUTOFF_DATE` env var
4. All GitHub Actions / CI checks on the PR head commit must be "success"

If all pass → calls `awardPoints()` → posts congratulatory comment with point
value. If any fail → posts a specific rejection comment explaining why.

### GitHub App authentication

The bot uses a **GitHub App** (not a personal access token). The difference:

- Personal access token = one user's identity, rate-limited per user
- GitHub App = bot identity, much higher rate limits, installed per-repo

The `@octokit/app` SDK handles:
- Generating JWT tokens from the App's private key
- Exchanging JWTs for short-lived installation tokens
- Refreshing tokens automatically

Every webhook event includes an `installation.id`. The handler calls
`getInstallationOctokit(installation.id)` to get a client with the right
permissions for that specific repo.

---

## Layer 5 — Frontend

**Location:** `/frontend`
**Port:** 3000
**Framework:** Next.js 16 + Tailwind CSS

The frontend consumes the backend API and the smart contracts.

### Wallet connection

Uses `wagmi` + `viem` — the standard React library for Ethereum/EVM wallets.
Configured in `src/config/wagmi.ts` for both Avalanche mainnet and Fuji
testnet. Supports MetaMask, Core Wallet, and any WalletConnect-compatible wallet.

### On-chain interaction

When a contributor wants to claim their USDC:
1. Frontend calls `GET /waves/:id/claim/:address` → gets `{ merkleRoot, amountUsdc, merkleProof }`
2. Frontend calls `MerkleClaim.claim(waveId, amount, proof)` using wagmi's
   `useWriteContract` hook
3. User signs the transaction in their wallet
4. Contract verifies the proof, transfers USDC, marks as claimed
5. Frontend calls `POST /waves/:id/claims` to record the on-chain event in Postgres

### Why wagmi/viem instead of ethers.js on the frontend?

`viem` is type-safe, tree-shakeable, and has first-class React hooks via `wagmi`.
`ethers.js` is used in the backend (for address checksumming in `auth.service.ts`)
where we don't need the React hooks.

---

## Database

**Provider:** Neon (hosted PostgreSQL)
**ORM:** Prisma 7

### Key tables

| Table | Purpose |
|---|---|
| `Ecosystem` | Registered project partners |
| `Wave` | Contribution cycles — has status, pool size, Merkle root |
| `WaveRepo` | Join table: which repos are in which wave |
| `Repository` | GitHub repos registered in WaveDrop |
| `Issue` | Tagged bounty issues with point values |
| `IssueApplication` | Records of /apply commands (enforces 5-cap) |
| `Contributor` | GitHub users with optional wallet addresses |
| `PullRequest` | PRs linked to issues |
| `PointsLedger` | Immutable log of every point award — never deleted |
| `Payout` | Computed USDC amounts + Merkle proofs per contributor per wave |
| `MerkleClaim` | Mirror of on-chain claim events |

### Why is PointsLedger immutable?

Audit trail. If someone disputes their payout you can show them every PR that
earned them points. The ledger is only written, never updated or deleted. The
`Payout` table is what gets recomputed if you need to regenerate the tree.

### Prisma 7 specifics

Prisma 7 removed the `url` field from `schema.prisma`. Connection config moved
to `prisma.config.ts`:
- `datasource.url` — used by `prisma migrate dev` (direct connection, no pooler)
- `client.adapter` — used at runtime (can use the pooler URL for efficiency)

Neon free tier suspends after 5 minutes of inactivity. The first connection
after a suspension takes 1-2 seconds to wake up. This is why `pnpm prisma:migrate`
sometimes gives P1001 on the second run — just retry.

---

## How a Full Wave Lifecycle Works

```
1. ADMIN creates wave via POST /waves
   → Wave record created with status=UPCOMING

2. ADMIN adds repos via POST /waves/:id/repos
   → Repository upserted, WaveRepo join record created
   → Issues upserted with point values

3. ADMIN opens wave (changes status to ACTIVE)
   → Ecosystem partner calls WaveEscrow.fund() on-chain to deposit USDC

4. GITHUB BOT syncs issues as maintainers add wave:100/150/200 labels
   → Issues appear in GET /waves/:id/issues

5. CONTRIBUTORS browse issues, comment /apply
   → GitHub bot assigns them, records IssueApplication

6. CONTRIBUTORS open PRs with "Closes #N" in the body
   → GitHub bot records PullRequest in DB

7. MAINTAINERS merge PRs
   → GitHub bot runs verification checks
   → If pass: calls awardPoints(), posts congrats comment
   → PointsLedger entry created

8. WAVE ENDS: ADMIN calls POST /waves/:id/close
   → Wave status → CLOSED
   → Merkle tree generated from PointsLedger
   → Payout records created with proofs
   → merkleRoot stored on Wave record

9. OPERATOR runs the settlement script
   → Calls WaveEscrow.approveForSettlement(MerkleClaim, total)
   → Calls MerkleClaim.submitRoot(waveId, root, escrow, token, amount)
   → Calls POST /waves/:id/settle to record on-chain wave ID

10. CONTRIBUTORS visit frontend
    → Connect wallet
    → Frontend fetches their proof from GET /waves/:id/claim/:address
    → Calls MerkleClaim.claim(waveId, amount, proof) via wagmi
    → USDC lands in their wallet
    → Frontend records the on-chain claim via POST /waves/:id/claims
```

---

## Running Locally

You need **3 terminal windows** running simultaneously for full local
development:

### Terminal 1 — Frontend (Next.js)
```bash
cd frontend
pnpm dev
# Runs on http://localhost:3000
```

### Terminal 2 — Backend API (Fastify)
```bash
cd backend
pnpm dev
# Runs on http://localhost:4000
```

### Terminal 3 — GitHub Webhook Server
```bash
cd backend/github-integration
pnpm dev
# Runs on http://localhost:4001
```

**You also need a tunnel for the webhook server** because GitHub needs to reach
port 4001 from the internet. Use `ngrok`:

```bash
ngrok http 4001
# Copy the https://xxxx.ngrok.io URL
# Paste it into your GitHub App settings as the Webhook URL:
# https://xxxx.ngrok.io/webhooks/github
```

### What each server does

| Server | Port | Who talks to it |
|---|---|---|
| Frontend | 3000 | Your browser |
| Backend API | 4000 | Frontend (fetches data, auth), Operator scripts |
| Webhook server | 4001 | GitHub (sends events when PRs/issues/comments happen) |

### Contracts don't run — they're already deployed

The Solidity contracts live on Avalanche Fuji testnet. You interact with them
via the frontend (wagmi/viem) or the operator script (forge script). You only
need to run `forge build` or `forge test` locally for development — there's no
local contract server.

### Database — always Neon

Even locally, you connect to your Neon cloud database. There's no local
Postgres needed. Neon auto-suspends when idle but wakes up in 1-2 seconds on
the first query.

---

## Environment Variables Explained

All in `/backend/.env` (copy from `.env.example`):

| Variable | What it is | Where it's used |
|---|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string | Backend API + Webhook server |
| `PORT` | Backend API port (default 4000) | Backend API |
| `GITHUB_WEBHOOK_PORT` | Webhook server port (default 4001) | Webhook server |
| `SESSION_SECRET` | Random 32+ char string for signing session cookies | Backend API auth |
| `FRONTEND_URL` | Your frontend URL (for CORS + OAuth redirect) | Backend API |
| `GITHUB_CLIENT_ID` | From your GitHub OAuth App | Backend API (login flow) |
| `GITHUB_CLIENT_SECRET` | From your GitHub OAuth App | Backend API (login flow) |
| `GITHUB_CALLBACK_URL` | Must match OAuth App settings exactly | Backend API |
| `GITHUB_APP_ID` | From your GitHub App | Webhook server |
| `GITHUB_APP_PRIVATE_KEY` | PEM key from GitHub App, `\n` for newlines | Webhook server |
| `GITHUB_WEBHOOK_SECRET` | Random string set in GitHub App settings | Webhook server (signature verification) |
| `ADMIN_GITHUB_LOGINS` | Comma-separated GitHub logins with admin access | Backend API |
| `AVALANCHE_RPC_URL` | Fuji testnet or mainnet RPC endpoint | Operator scripts |
| `SETTLEMENT_PRIVATE_KEY` | Wallet key for the operator (submits Merkle roots) | Operator scripts |
| `REGISTRY_ADDRESS` | Deployed WaveRegistry contract address | Frontend + Operator |
| `MERKLE_CLAIM_ADDRESS` | Deployed MerkleClaim contract address | Frontend + Operator |
| `PR_CUTOFF_DATE` | ISO date — PRs before this date won't earn points | Webhook server |

Note: `GITHUB_CLIENT_ID/SECRET` (OAuth App) and `GITHUB_APP_ID/PRIVATE_KEY`
(GitHub App) are two different things. The OAuth App handles user login on the
website. The GitHub App handles the bot and webhooks.
