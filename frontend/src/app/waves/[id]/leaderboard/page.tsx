"use client";
import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import { api } from "../../../../lib/api";
import { Card }       from "../../../../components/ui/Card";
import { Button }     from "../../../../components/ui/Button";
import { PageSpinner } from "../../../../components/ui/Spinner";
import { Table, Thead, Tbody, Th, Td, Tr } from "../../../../components/ui/Table";

export default function LeaderboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }  = use(params);
  const [page, setPage] = useState(1);

  const { data: wave } = useQuery({
    queryKey: ["wave", id],
    queryFn:  () => api.waves.get(id),
  });

  const { data, isLoading } = useQuery({
    queryKey:        ["leaderboard", id, page],
    queryFn:         () => api.leaderboard.get(id, page),
    refetchInterval: 15_000,   // refresh every 15s — "live updating"
  });

  return (
    <div>
      <div className="flex items-center gap-2 text-xs text-[#55556a] mb-4">
        <Link href="/waves">Waves</Link>
        <span>/</span>
        <Link href={`/waves/${id}`}>{wave?.name ?? id}</Link>
        <span>/</span>
        <span>Leaderboard</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#f0f0f4]">Leaderboard</h1>
          <p className="text-sm text-[#55556a] mt-0.5">Updates every 15 seconds</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
          <span className="text-xs text-[#55556a]">Live</span>
        </div>
      </div>

      {isLoading && <PageSpinner />}

      {data && (
        <>
          <Card padding="none">
            <Table>
              <Thead>
                <tr>
                  <Th className="w-16">Rank</Th>
                  <Th>Contributor</Th>
                  <Th className="text-right">Points</Th>
                  <Th className="text-right">Est. USDC</Th>
                </tr>
              </Thead>
              <Tbody>
                {data.data.map((entry) => (
                  <Tr key={entry.rank}>
                    <Td className="text-center">
                      {entry.rank <= 3 ? (
                        <span className="text-base">
                          {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : "🥉"}
                        </span>
                      ) : (
                        <span className="font-mono text-xs text-[#55556a]">#{entry.rank}</span>
                      )}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        {entry.contributor?.avatarUrl ? (
                          <Image
                            src={entry.contributor.avatarUrl}
                            alt={entry.contributor.githubLogin}
                            width={24} height={24}
                            className="rounded-full"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-[#27272e]" />
                        )}
                        <span className="text-[#f0f0f4] text-sm">
                          {entry.contributor?.githubLogin ?? "Unknown"}
                        </span>
                      </div>
                    </Td>
                    <Td className="text-right font-semibold text-[#f0f0f4]">
                      {entry.totalPoints.toLocaleString()}
                    </Td>
                    <Td className="text-right text-xs text-[#55556a]">
                      {wave ? computeEstimate(entry.totalPoints, data.data, wave.poolAmountUsdc) : "—"}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Card>

          {data.pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-[#55556a]">{data.total} contributors</p>
              <div className="flex gap-2">
                <Button size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  Previous
                </Button>
                <Button size="sm" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function computeEstimate(
  myPoints: number,
  allEntries: { totalPoints: number }[],
  poolAmountUsdc: string
): string {
  const total = allEntries.reduce((s, e) => s + e.totalPoints, 0);
  if (total === 0) return "$0.00";
  const share = (myPoints / total) * parseFloat(poolAmountUsdc);
  return `$${share.toFixed(2)}`;
}
