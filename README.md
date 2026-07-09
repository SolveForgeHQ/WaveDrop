# WaveDrop

A recurring contribution-bounty platform on Avalanche. Ecosystem partners fund a reward pool each cycle ("Wave"). Contributors browse GitHub issues tagged with point values, submit PRs, and earn USDC payouts proportional to points earned when the Wave closes.

---

## Architecture Overview

```
wavedrop/
├── contracts/   Solidity (Foundry) — on-chain settlement only
├── backend/     Node.js + TypeScript + Fastify — off-chain logic & API
├── frontend/    Next.js + TypeScript + Tailwind — contributor UI
└── shared/      Shared TypeScript types & constants
```

### Core Design Principle: Off-chain tracking, on-chain settlement

Points and leaderboard data live entirely in **Postgres** (via Prisma). This is intentional:

- Zero gas cost for every PR merge / point award
- Sub-second leaderboard queries
- Full audit trail without on-chain noise

When a Wave closes, the backend:
1. Tallies each contributor's points as a share of the total pool
2. Computes USDC amounts (pro-rata)
3. Builds a **Merkle tree** over `(address, amount)` leaf pairs
4. Stores the Merkle root on-chain in `WaveDropDistributor`
5. Contributors call `claim()` with their Merkle proof — trustless, auditable, cheap

This is the same pattern used by [Uniswap's merkle-distributor](https://github.com/Uniswap/merkle-distributor).

---

## Core Entities

| Entity | Layer | Description |
|---|---|---|
| `Ecosystem` | Off-chain | A project/partner that funds Waves |
| `Wave` | Off-chain + On-chain | A contribution cycle with a USDC pool and date range |
| `Repository` | Off-chain | GitHub repo linked to an Ecosystem |
| `Issue` | Off-chain | Tagged GitHub issue with a point value |
| `Contributor` | Off-chain | GitHub user / wallet address |
| `PullRequest` | Off-chain | Submitted PR linked to an Issue |
| `PointsLedger` | Off-chain | Immutable log of every point award |
| `Payout` | Off-chain | Computed USDC amount per contributor per Wave |
| `MerkleClaim` | On-chain | Proof-based claim tracked in the contract |

---

## Payout Token

| Network | Token | Address |
|---|---|---|
| Avalanche C-Chain (mainnet) | USDC | `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6c` |
| Fuji testnet | Mock ERC-20 | Deployed per-environment (see `contracts/src/MockERC20.sol`) |

---

## Packages

### `/contracts` — Foundry

- `WaveDropDistributor.sol` — stores Merkle roots, handles `claim()`
- `MockERC20.sol` — USDC stand-in for Fuji testnet

### `/backend` — Fastify + Prisma

- REST/JSON API consumed by the frontend
- GitHub webhook handler (PR merged → points awarded)
- Wave settlement service (builds Merkle tree, calls contract)
- Prisma schema covering all core entities

### `/frontend` — Next.js + Tailwind + wagmi

- Browse active Waves and leaderboards
- Connect wallet (MetaMask / Core Wallet)
- Claim USDC by submitting a Merkle proof

### `/shared` — Pure TypeScript

- Entity type definitions shared by backend & frontend
- Chain constants (RPC URLs, contract addresses, token addresses)
- Merkle tree utilities (leaf encoding, proof verification)

---

## Getting Started

### Prerequisites

- [pnpm](https://pnpm.io/) ≥ 9
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js ≥ 20
- PostgreSQL

### Install

```bash
pnpm install
```

### Backend

```bash
cd backend
cp .env.example .env      # fill in DATABASE_URL, RPC_URL, etc.
pnpm prisma migrate dev
pnpm dev
```

### Frontend

```bash
cd frontend
pnpm dev
```

### Contracts

```bash
cd contracts
forge build
forge test
```

---

## Network Config

```
Avalanche C-Chain RPC: https://api.avax.network/ext/bc/C/rpc
Fuji Testnet RPC:      https://api.avax-test.network/ext/bc/C/rpc
Chain ID (mainnet):    43114
Chain ID (Fuji):       43113
```
