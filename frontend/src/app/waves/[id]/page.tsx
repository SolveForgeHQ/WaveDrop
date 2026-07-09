"use client";
import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api, type Complexity } from "../../../lib/api";
import { Badge }      from "../../../components/ui/Badge";
import { Button }     from "../../../components/ui/Button";
import { Card }       from "../../../components/ui/Card";
import { PageSpinner } from "../../../components/ui/Spinner";
import { Table, Thead, Tbody, Th, Td, Tr } from "../../../components/ui/Table";

const POINT_FILTERS: { label: string; value: Complexity | "" }[] = [
  { label: "All",      value: ""       },
  { label: "100 pts",  value: "EASY"   },
  { label: "150 pts",  value: "MEDIUM" },
  { label: "200 pts",  value: "HARD"   },
];

const complexityBadge: Record<Complexity, "accent" | "warning" | "danger"> = {
  EASY: "accent", MEDIUM: "warning", HARD: "danger",
};

export default function WavePage({ params }: { params: Promise<{ id: string }> }) {
  const { id }           = use(params);
  const [complexity, setComplexity] = useState<Complexity | "">("");
  const [page, setPage]  = useState(1);

  const { data: wave, isLoading: waveLoading } = useQuery({
    queryKey: ["wave", id],
    queryFn:  () => api.waves.get(id),
  });

  const { data: issues, isLoading: issuesLoading } = useQuery({
    queryKey: ["issues", id, complexity, page],
    queryFn:  () => api.issues.list(id, { complexity: complexity || undefined, page }),
  });

  if (waveLoading) return <PageSpinner />;
  if (!wave) return <div className="text-[#55556a] text-sm">Wave not found.</div>;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-[#55556a] mb-2">
          <Link href="/waves" className="hover:text-[#8888a0]">Waves</Link>
          <span>/</span>
          <span>{wave.name}</span>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#f0f0f4]">{wave.name}</h1>
            <p className="text-sm text-[#55556a] mt-0.5">{wave.ecosystem.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/waves/${id}/leaderboard`}>
              <Button size="sm" variant="ghost">Leaderboard</Button>
            </Link>
            <div className="text-right">
              <p className="text-xs text-[#55556a]">Pool</p>
              <p className="text-sm font-semibold text-[#f0f0f4]">${wave.poolAmountUsdc} USDC</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-5">
        <span className="text-xs text-[#55556a]">Points:</span>
        {POINT_FILTERS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => { setComplexity(value); setPage(1); }}
            className={`px-3 py-1 text-xs font-medium rounded-md border transition-colors ${
              complexity === value
                ? "bg-[#7c5cfc20] border-[#7c5cfc] text-[#7c5cfc]"
                : "border-[#27272e] text-[#55556a] hover:text-[#8888a0] hover:border-[#3a3a48]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Issues table */}
      {issuesLoading && <PageSpinner />}

      {issues && (
        <>
          <Card padding="none">
            <Table>
              <Thead>
                <tr>
                  <Th>Issue</Th>
                  <Th>Repo</Th>
                  <Th>Points</Th>
                  <Th>Status</Th>
                  <Th></Th>
                </tr>
              </Thead>
              <Tbody>
                {issues.data.length === 0 && (
                  <Tr>
                    <Td colSpan={5} className="text-center py-8 text-[#55556a]">
                      No issues found.
                    </Td>
                  </Tr>
                )}
                {issues.data.map((issue) => (
                  <Tr key={issue.id}>
                    <Td className="text-[#f0f0f4] max-w-sm">
                      <p className="font-medium truncate">{issue.title}</p>
                      <p className="text-xs text-[#55556a] mt-0.5">#{issue.githubNumber}</p>
                    </Td>
                    <Td className="font-mono text-xs">
                      {issue.repository.owner}/{issue.repository.name}
                    </Td>
                    <Td>
                      <Badge variant={complexityBadge[issue.complexity]}>
                        {issue.points} pts
                      </Badge>
                    </Td>
                    <Td>
                      {issue.isClaimed ? (
                        <Badge variant="muted">Claimed</Badge>
                      ) : issue.assignedTo ? (
                        <Badge variant="warning">@{issue.assignedTo}</Badge>
                      ) : (
                        <Badge variant="success">Open</Badge>
                      )}
                    </Td>
                    <Td>
                      {!issue.isClaimed && !issue.assignedTo && (
                        <a
                          href={issue.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button size="sm" variant="primary">Apply</Button>
                        </a>
                      )}
                      {!issue.isClaimed && issue.assignedTo && (
                        <a href={issue.url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="ghost">View</Button>
                        </a>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Card>

          {/* Pagination */}
          {issues.pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-[#55556a]">
                {issues.total} issues · page {issues.page} of {issues.pages}
              </p>
              <div className="flex gap-2">
                <Button size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  Previous
                </Button>
                <Button size="sm" disabled={page >= issues.pages} onClick={() => setPage(p => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Apply instructions */}
      <Card className="mt-6 border-[#7c5cfc40] bg-[#7c5cfc08]">
        <p className="text-xs text-[#8888a0]">
          <span className="text-[#7c5cfc] font-semibold">How to apply:</span> Click Apply to open
          the issue on GitHub, then comment{" "}
          <code className="px-1.5 py-0.5 bg-[#18181f] rounded text-[#7c5cfc] font-mono">/apply</code>
          {" "}in the thread. The WaveDrop bot will assign you automatically (max 5 issues per wave).
        </p>
      </Card>
    </div>
  );
}
