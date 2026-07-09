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
 * Validate and checksum an EVM wallet address.
 * Returns the checksummed address or throws if invalid.
 */
export function validateAndChecksumAddress(raw: string): string {
  if (!isAddress(raw)) {
    throw new Error(`Invalid EVM address: ${raw}`);
  }
  return getAddress(raw); // EIP-55 checksum
}

/**
 * Link a wallet address to a contributor.
 * Validates the address is a proper 0x EIP-55 checksummed address.
 */
export async function linkWalletAddress(contributorId: string, rawAddress: string) {
  const checksummed = validateAndChecksumAddress(rawAddress);
  return contributorRepo.setWalletAddress(contributorId, checksummed);
}
