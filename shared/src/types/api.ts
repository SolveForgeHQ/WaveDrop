/**
 * API request / response shapes shared between backend and frontend.
 */

import type { Wave, Contributor, Payout, PointsLedger } from "./entities.js";

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

export interface LeaderboardEntry {
  rank: number;
  contributor: Pick<Contributor, "id" | "githubLogin" | "avatarUrl">;
  totalPoints: number;
  estimatedUsdc: string; // human-readable, e.g. "42.50"
}

export interface GetLeaderboardResponse {
  waveId: string;
  entries: LeaderboardEntry[];
}

// ---------------------------------------------------------------------------
// Wave
// ---------------------------------------------------------------------------

export interface GetWaveResponse {
  wave: Wave;
  totalPointsAwarded: number;
  claimCount: number;
}

// ---------------------------------------------------------------------------
// Claim
// ---------------------------------------------------------------------------

export interface GetClaimProofResponse {
  payout: Payout;
  merkleRoot: string;
}

// ---------------------------------------------------------------------------
// Contributor profile
// ---------------------------------------------------------------------------

export interface GetContributorResponse {
  contributor: Contributor;
  recentActivity: PointsLedger[];
}
