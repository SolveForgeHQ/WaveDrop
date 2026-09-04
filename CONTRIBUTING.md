# Contributing to WaveDrop

Thank you for your interest in contributing to **WaveDrop**! 🌊

WaveDrop is an open-source contribution-bounty platform on Avalanche. We welcome contributions of all kinds: bug fixes, new features, documentation enhancements, UI improvements, and smart contract optimizations.

---

## Code of Conduct

All contributors are expected to uphold our [Code of Conduct](./CODE_OF_CONDUCT.md). Please report unacceptable behavior to the maintainers.

---

## Architecture at a Glance

WaveDrop is structured as a pnpm monorepo:

- **[contracts/](./contracts)**: Solidity smart contracts managed with Foundry (WaveRegistry, WaveEscrow, MerkleClaim).
- **[ackend/](./backend)**: Fastify REST API, Prisma ORM (PostgreSQL), authentication, points calculation, and Merkle tree generation.
- **[ackend/github-integration/](./backend/github-integration)**: Webhook service handling /apply comments, issue labeling, and PR merges.
- **[rontend/](./frontend)**: Next.js + Tailwind CSS + wagmi/viem contributor dashboard and claim portal.
- **[shared/](./shared)**: Shared TypeScript types, chain configurations, and Merkle tree utilities.

For an in-depth architectural breakdown, check out [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Getting Started Locally

### 1. Prerequisites
- **Node.js**: >= 20.x
- **pnpm**: >= 9.x (
pm install -g pnpm)
- **Foundry**: [Install Foundry](https://book.getfoundry.sh/getting-started/installation) (oundryup)
- **PostgreSQL**: Local PostgreSQL server or Docker container

### 2. Monorepo Setup

Clone the repository and install all dependencies:

`ash
git clone https://github.com/SolveForgeHQ/WaveDrop.git
cd WaveDrop
pnpm install
`

### 3. Environment Configuration

Copy example environment files:

`ash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env.local
`

### 4. Database Setup

Run Prisma migrations from the backend package:

`ash
cd backend
pnpm prisma migrate dev
pnpm db:seed # Seeds initial waves, issues, and contributor records
cd ..
`

### 5. Running the Apps

Start development servers across packages:

`ash
# Run backend API
pnpm --filter @wavedrop/backend dev

# Run frontend Next.js app
pnpm --filter @wavedrop/frontend dev

# Run GitHub integration webhook service (optional for local webhook testing)
pnpm --filter @wavedrop/github-integration dev
`

---

## Working on Smart Contracts

The contracts layer uses Foundry.

`ash
cd contracts

# Compile contracts
forge build

# Run unit and integration tests
forge test

# Format Solidity code
forge fmt
`

---

## How to Work on Bounties & Earn Points

WaveDrop utilizes its own platform workflow for open-source contributions:

1. **Find an Issue**: Browse open issues tagged with a wave label (e.g. wave:1) and a points tag (e.g. points:100).
2. **Apply for Assignment**: Leave a comment with /apply on the issue. The WaveDrop bot will assign you if eligible.
3. **Open a Pull Request**: Submit your PR referencing the issue (e.g. Fixes #123).
4. **Merge & Point Award**: Once reviewed and merged by maintainers, the webhook bot automatically records your points in the off-chain points ledger.
5. **Claim Reward**: At the end of the Wave cycle, claim your pro-rata USDC reward via the frontend portal using your linked Avalanche wallet address.

---

## Commit Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) standard. Please structure your commit messages like:

`
<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]
`

### Types:
- eat: A new feature
- ix: A bug fix
- docs: Documentation only changes
- style: Changes that do not affect the meaning of the code (formatting, white-space)
- efactor: A code change that neither fixes a bug nor adds a feature
- 	est: Adding missing tests or correcting existing tests
- chore: Changes to the build process or auxiliary tools and libraries

---

## Submitting a Pull Request

1. Create a descriptive branch from main:
   `ash
   git checkout -b feat/add-user-profile
   `
2. Make your changes and ensure all tests, linting, and typechecks pass:
   `ash
   pnpm build
   pnpm lint
   `
3. Commit your changes with conventional commit messages.
4. Push your branch to GitHub and open a Pull Request against main.
5. Fill out the PR template checklist completely.
6. Engage with maintainers during the code review process.
