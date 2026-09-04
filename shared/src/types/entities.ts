/**
 * Core WaveDrop entity types shared across backend and frontend.
 * These mirror the Prisma schema — keep them in sync.
 */

export type WaveStatus = "UPCOMING" | "ACTIVE" | "CLOSED" | "SETTLED";

export type PullRequestStatus = "OPEN" | "MERGED" | "CLOSED";

// ---------------------------------------------------------------------------
// Ecosystem
// ---------------------------------------------------------------------------

export interface Ecosystem {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  githubOrg: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Wave
// ---------------------------------------------------------------------------

export interface Wave {
  id: string;
  ecosystemId: string;
  name: string;
  description: string | null;
  status: WaveStatus;
  /** Total USDC allocated for this wave (in human-readable units, e.g. "1000.00") */
  poolAmountUsdc: string;
  startsAt: Date;
  endsAt: Date;
  /** On-chain Merkle root, set when wave is SETTLED */
  merkleRoot: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export interface Repository {
  id: string;
  ecosystemId: string;
  owner: string; // GitHub org or user
  name: string; // GitHub repo name
  installationId: string | null; // GitHub App installation ID
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Issue
// ---------------------------------------------------------------------------

export interface Issue {
  id: string;
  repositoryId: string;
  githubNumber: number;
  title: string;
  url: string;
  /** Points awarded upon a PR for this issue being merged */
  points: number;
  /** True once a PR that closes this issue has been merged */
  isClosed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Contributor
// ---------------------------------------------------------------------------

export interface Contributor {
  id: string;
  githubLogin: string;
  githubId: number;
  githubEmail?: string | null;
  avatarUrl: string | null;
  /** Stellar or EVM wallet address for receiving USDC payouts */
  walletAddress: string | null;
  ledger?: PointsLedger[];
  payouts?: Payout[];
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Pull Request
// ---------------------------------------------------------------------------

export interface PullRequest {
  id: string;
  issueId: string;
  contributorId: string;
  repositoryId: string;
  githubNumber: number;
  title: string;
  url: string;
  status: PullRequestStatus;
  mergedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Points Ledger
// ---------------------------------------------------------------------------

/** Immutable record of every point award event */
export interface PointsLedger {
  id: string;
  waveId: string;
  contributorId: string;
  pullRequestId: string;
  points: number;
  reason: string | null;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Payout
// ---------------------------------------------------------------------------

/** Computed USDC payout for a contributor in a given wave */
export interface Payout {
  id: string;
  waveId: string;
  contributorId: string;
  walletAddress: string;
  /** Total points earned in this wave */
  totalPoints: number;
  /** USDC amount in smallest unit (6 decimals) */
  amountUsdc: string;
  /** Hex-encoded Merkle proof (JSON array of bytes32) */
  merkleProof: string[] | null;
  claimedAt: Date | null;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Merkle Claim (mirrors on-chain state)
// ---------------------------------------------------------------------------

export interface MerkleClaim {
  id: string;
  waveId: string;
  payoutId: string;
  walletAddress: string;
  amountUsdc: string;
  txHash: string;
  claimedAt: Date;
}
