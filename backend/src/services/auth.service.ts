import { getAddress, isAddress } from "ethers";
import { contributorRepo } from "../repositories/contributor.repo.js";

export interface GitHubUserInfo {
  id:        number;
  login:     string;
  email:     string | null;
  avatar_url: string;
}

/**
 * Fetch the authenticated GitHub user's profile using their OAuth access token.
 */
export async function fetchGitHubUser(accessToken: string): Promise<GitHubUserInfo> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept:        "application/vnd.github+json",
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<GitHubUserInfo>;
}

/**
 * Upsert a contributor from a successful GitHub OAuth callback.
 * Returns the contributor record.
 */
export async function loginOrRegisterContributor(
  accessToken: string,
  userInfo: GitHubUserInfo
) {
  return contributorRepo.upsert({
    githubId:    userInfo.id,
    githubLogin: userInfo.login,
    githubEmail: userInfo.email,
    avatarUrl:   userInfo.avatar_url,
    accessToken, // store for later GitHub API calls (webhook, etc.)
  });
}

/**
 * Validate Stellar public key (G... 56 chars base32) or EVM address.
 */
export function validateWalletAddress(raw: string): string {
  const trimmed = raw.trim();

  // Check if valid Stellar account public key or Soroban contract ID
  const stellarRegex = /^[G|C][A-Z2-7]{55}$/;
  if (stellarRegex.test(trimmed)) {
    return trimmed;
  }

  // Fallback check if EVM address
  if (isAddress(trimmed)) {
    return getAddress(trimmed);
  }

  throw new Error("Invalid wallet address: " + trimmed + ". Must be a valid Stellar public key (starts with G) or EVM address.");
}

/**
 * Link a wallet address to a contributor.
 */
export async function linkWalletAddress(contributorId: string, rawAddress: string) {
  const validated = validateWalletAddress(rawAddress);
  return contributorRepo.setWalletAddress(contributorId, validated);
}
