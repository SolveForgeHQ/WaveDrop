# WaveDrop

WaveDrop is an open-source, recurring contribution-bounty platform built on the **Stellar blockchain**. Ecosystem partners fund a reward pool each cycle ("Wave"). Contributors browse GitHub issues, submit Pull Requests, and earn USDC payouts proportional to the points they accumulated when the Wave closes.

---

## 🏗 Architecture Overview

WaveDrop uses a monorepo structure managed by pnpm workspaces:

`	ext
wavedrop/
├── backend/     Node.js + Fastify + Prisma — off-chain logic, API, & GitHub Webhooks
├── frontend/    Next.js + Tailwind — contributor UI & dashboard
├── contracts/   Rust (Soroban) — on-chain Stellar settlement layer
└── shared/      Shared TypeScript types & constants
`

### Core Design Principle: Off-chain tracking, on-chain settlement

Points and leaderboard data live entirely in **Postgres**. This is intentional:
- Zero transaction fees for every PR merge or point award
- Sub-second leaderboard queries
- Full audit trail without on-chain noise

When a Wave closes, the backend:
1. Tallies each contributor's points as a share of the total pool
2. Computes USDC amounts (pro-rata)
3. Builds a **Merkle tree** over (address, amount) leaf pairs
4. Submits the Merkle root on-chain to the Soroban smart contract
5. Contributors can then claim their USDC trustlessly on the Stellar network by providing their Merkle proof.

---

## 🚀 Getting Started (Local Development)

We provide a frictionless Docker-based setup so you can start contributing immediately.

### Prerequisites
- [Docker & Docker Compose](https://docs.docker.com/get-docker/)
- [Node.js](https://nodejs.org/) (v20+)
- [pnpm](https://pnpm.io/) (v9+)

### 1. Start the Local Database
WaveDrop uses PostgreSQL. Spin it up using Docker:
`ash
docker compose up -d
`

### 2. Install Dependencies & Build
Install all monorepo dependencies and generate the Prisma client:
`ash
pnpm install
`

### 3. Setup Environment Variables
`ash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
`

### 4. Setup the Database Schema & Seed Data
Push the schema to your local database and seed it with realistic test data (Ecosystems, Waves, Issues, and Contributors) so you don't stare at an empty UI!
`ash
cd backend
pnpm prisma db push
pnpm db:seed
`

### 5. Run the Apps
You can run the backend and frontend simultaneously from the root directory:
`ash
# Start backend API (http://localhost:4000)
pnpm --filter @wavedrop/backend dev

# Start frontend UI (http://localhost:3000)
pnpm --filter @wavedrop/frontend dev
`

---

## ⛓ Smart Contracts (Stellar / Soroban)

WaveDrop is currently migrating its smart contracts to **Soroban** (Stellar's smart contract platform). 

To contribute to the Rust contracts, you will need the Rust toolchain and Stellar CLI. Please see the [Contracts README](./contracts/README.md) for detailed setup instructions.

### Supported Networks
| Network | USDC Issuer Address |
|---------|---------------------|
| Stellar Mainnet | GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN |
| Stellar Testnet | GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5 |

---

## 🤝 Contributing

We welcome community contributions! This project is submitted on **GrandFox** for open source bounties. 

Please read our [Contributing Guide](CONTRIBUTING.md) to learn how to get started, pick up an issue, and earn rewards.

## 📄 License
This project is licensed under the [MIT License](LICENSE).
