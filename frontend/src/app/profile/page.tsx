"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { api } from "../../lib/api";
import { Card, CardHeader, CardTitle } from "../../components/ui/Card";
import { Button }     from "../../components/ui/Button";
import { Badge }      from "../../components/ui/Badge";
import { Input, Label } from "../../components/ui/Input";
import { PageSpinner }  from "../../components/ui/Spinner";

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const { connect }    = useConnect();
  const { disconnect } = useDisconnect();
  const qc             = useQueryClient();

  const { data: me, isLoading, error } = useQuery({
    queryKey: ["me"],
    queryFn:  api.auth.me,
    retry:    false,
  });

  const linkMutation = useMutation({
    mutationFn: (addr: string) => api.auth.linkWallet(addr),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["me"] }),
  });

  const handleLinkWallet = () => {
    if (!address) {
      connect({ connector: injected() });
      return;
    }
    linkMutation.mutate(address);
  };

  if (isLoading) return <PageSpinner />;

  if (!me || error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-56px)]">
        <Card className="max-w-sm w-full text-center p-8">
          <div className="w-12 h-12 rounded-full bg-[#7c5cfc20] flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">👤</span>
          </div>
          <h2 className="text-sm font-semibold text-[#f0f0f4] mb-2">Sign in to WaveDrop</h2>
          <p className="text-xs text-[#55556a] mb-5">
            Connect your GitHub account to track contributions and claim USDC rewards.
          </p>
          <a href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/auth/github`}>
            <Button variant="primary" className="w-full justify-center">
              Continue with GitHub
            </Button>
          </a>
        </Card>
      </div>
    );
  }

  const totalPoints = me.ledger?.reduce((s, e) => s + e.points, 0) ?? 0;

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-[#f0f0f4] mb-6">Profile</h1>

      {/* Identity card */}
      <Card className="mb-4">
        <div className="flex items-center gap-4">
          {me.avatarUrl ? (
            <Image src={me.avatarUrl} alt={me.githubLogin} width={48} height={48} className="rounded-full" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[#27272e]" />
          )}
          <div className="flex-1">
            <p className="text-sm font-semibold text-[#f0f0f4]">@{me.githubLogin}</p>
            {me.githubEmail && <p className="text-xs text-[#55556a]">{me.githubEmail}</p>}
          </div>
          <Button size="sm" variant="ghost" onClick={() => api.auth.logout().then(() => qc.clear())}>
            Sign out
          </Button>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Card>
          <p className="text-xs text-[#55556a] mb-1">Lifetime Points</p>
          <p className="text-2xl font-bold text-[#f0f0f4]">{totalPoints.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs text-[#55556a] mb-1">Contributions</p>
          <p className="text-2xl font-bold text-[#f0f0f4]">{me.ledger?.length ?? 0}</p>
        </Card>
      </div>

      {/* Wallet */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Avalanche Wallet</CardTitle>
          {me.walletAddress && <Badge variant="success">Linked</Badge>}
        </CardHeader>

        {me.walletAddress ? (
          <div className="flex items-center justify-between">
            <code className="text-xs font-mono text-[#8888a0] bg-[#0a0a0f] px-3 py-2 rounded-lg">
              {me.walletAddress}
            </code>
            <Button size="sm" variant="ghost" onClick={handleLinkWallet} loading={linkMutation.isPending}>
              Update
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-[#55556a]">
              Link your wallet to receive USDC payouts when a wave settles.
            </p>
            {isConnected && address ? (
              <div className="flex items-center gap-3">
                <code className="text-xs font-mono text-[#8888a0]">
                  {address.slice(0, 8)}…{address.slice(-6)}
                </code>
                <Button
                  size="sm" variant="primary"
                  onClick={handleLinkWallet}
                  loading={linkMutation.isPending}
                >
                  Link this wallet
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={() => connect({ connector: injected() })}>
                Connect Wallet
              </Button>
            )}
          </div>
        )}

        {linkMutation.error && (
          <p className="text-xs text-[#ef4444] mt-2">{linkMutation.error.message}</p>
        )}
        {linkMutation.isSuccess && (
          <p className="text-xs text-[#22c55e] mt-2">Wallet linked successfully.</p>
        )}
      </Card>

      {/* Recent activity */}
      <Card>
        <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
        {!me.ledger || me.ledger.length === 0 ? (
          <p className="text-xs text-[#55556a]">No activity yet. Start contributing to a wave!</p>
        ) : (
          <div className="space-y-3">
            {me.ledger.slice(0, 10).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#f0f0f4] truncate">
                    <Link href={entry.pullRequest.url} target="_blank" className="hover:text-[#7c5cfc]">
                      {entry.pullRequest.title}
                    </Link>
                  </p>
                  <p className="text-xs text-[#55556a] mt-0.5">{entry.wave.name}</p>
                </div>
                <Badge variant="accent" className="ml-3 shrink-0">+{entry.points} pts</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
