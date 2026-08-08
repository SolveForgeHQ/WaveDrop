const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",           // send session cookie
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ── Auth ────────────────────────────────────────────────────────────────────

export const api = {
  auth: {
    me: ()                           => request<Contributor>("/auth/me"),
    linkWallet: (addr: string)       => request<{ walletAddress: string }>("/auth/wallet", {
      method: "POST", body: JSON.stringify({ walletAddress: addr }),
    }),
    logout: ()                       => request("/auth/logout", { method: "POST" }),
  },

  // ── Waves ─────────────────────────────────────────────────────────────────
  waves: {
    list: (status?: string)          => request<Wave[]>(`/waves${status ? `?status=${status}` : ""}`),
    get:  (id: string)               => request<WaveDetail>(`/waves/${id}`),
    create: (body: CreateWaveBody)   => request<Wave>("/waves", { method: "POST", body: JSON.stringify(body) }),
    addRepo: (id: string, body: AddRepoBody) =>
      request(`/waves/${id}/repos`, { method: "POST", body: JSON.stringify(body) }),
    close: (id: string)              => request<CloseWaveResult>(`/waves/${id}/close`, { method: "POST" }),
    settle: (id: string, body: { merkleRoot: string; onChainWaveId?: string }) =>
      request(`/waves/${id}/settle`, { method: "POST", body: JSON.stringify(body) }),
  },

  // ── Issues ────────────────────────────────────────────────────────────────
  issues: {
    list: (waveId: string, params?: IssueParams) => {
      const q = new URLSearchParams();
      if (params?.complexity) q.set("complexity", params.complexity);
      if (params?.page)       q.set("page",       String(params.page));
      if (params?.pageSize)   q.set("pageSize",   String(params.pageSize));
      return request<PaginatedIssues>(`/waves/${waveId}/issues?${q}`);
    },
  },

  // ── Leaderboard ───────────────────────────────────────────────────────────
  leaderboard: {
    get: (waveId: string, page = 1) =>
      request<LeaderboardResponse>(`/waves/${waveId}/leaderboard?page=${page}`),
  },

  // ── Claims ────────────────────────────────────────────────────────────────
  claims: {
    getProof: (waveId: string, address: string) =>
      request<ClaimProof>(`/waves/${waveId}/claim/${address}`),
    settlement: (waveId: string)     => request<Settlement>(`/waves/${waveId}/settlement`),
    record: (waveId: string, body: RecordClaimBody) =>
      request(`/waves/${waveId}/claims`, { method: "POST", body: JSON.stringify(body) }),
  },

  // ── Contributors ──────────────────────────────────────────────────────────
  contributors: {
    get: (login: string)             => request<ContributorProfile>(`/contributors/${login}`),
  },
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface Contributor {
  id: string; githubLogin: string; githubEmail?: string;
  avatarUrl?: string; walletAddress?: string; createdAt: string;
}

export interface Wave {
  id: string; name: string; description?: string; status: WaveStatus;
  poolAmountUsdc: string; startsAt: string; endsAt: string;
  merkleRoot?: string; onChainWaveId?: string;
  ecosystem: { id: string; name: string; logoUrl?: string };
}

export interface WaveDetail extends Wave {
  repositories: Array<{ repository: { id: string; owner: string; name: string } }>;
}

export type WaveStatus = "UPCOMING" | "ACTIVE" | "CLOSED" | "SETTLED";
export type Complexity = "EASY" | "MEDIUM" | "HARD";

export interface Issue {
  id: string; githubNumber: number; title: string; url: string;
  complexity: Complexity; points: number; isOpen: boolean;
  isClaimed: boolean; assignedTo?: string;
  applicationCount?: number;
  repository: { owner: string; name: string };
}

export interface PaginatedIssues {
  data: Issue[]; total: number; page: number; pageSize: number; pages: number;
}

export interface IssueParams { complexity?: Complexity; page?: number; pageSize?: number }

export interface LeaderboardEntry {
  rank: number; totalPoints: number;
  contributor?: { id: string; githubLogin: string; avatarUrl?: string; walletAddress?: string };
}

export interface LeaderboardResponse {
  data: LeaderboardEntry[]; total: number; page: number; pageSize: number; pages: number;
}

export interface ClaimProof {
  merkleRoot: string; walletAddress: string; amountUsdc: string;
  totalPoints: number; merkleProof: string[]; claimedAt?: string;
}

export interface Settlement { waveId: string; payouts: ClaimProof[] }

export interface ContributorProfile extends Contributor {
  ledger: Array<{
    id: string; points: number; reason?: string; createdAt: string;
    wave: { id: string; name: string };
    pullRequest: { githubNumber: number; title: string; url: string };
  }>;
}

export interface CreateWaveBody {
  ecosystemId: string; name: string; description?: string;
  poolAmountUsdc: string; startsAt: string; endsAt: string;
}

export interface AddRepoBody {
  repoOwner: string; repoName: string; ecosystemId: string;
  issues: Array<{ githubNumber: number; title: string; url: string; complexity: Complexity }>;
}

export interface RecordClaimBody { walletAddress: string; amountUsdc: string; txHash: string }
export interface CloseWaveResult  { message: string; merkleRoot: string; totalLeaves: number }
