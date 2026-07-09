"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type WaveStatus } from "../../lib/api";
import { useAuthGuard } from "../../lib/useAuthGuard";
import { WaveCard } from "../../components/WaveCard";
import { Button }   from "../../components/ui/Button";
import { PageSpinner } from "../../components/ui/Spinner";

const FILTERS: { label: string; value: WaveStatus | "" }[] = [
  { label: "All",      value: ""         },
  { label: "Active",   value: "ACTIVE"   },
  { label: "Upcoming", value: "UPCOMING" },
  { label: "Closed",   value: "CLOSED"   },
  { label: "Settled",  value: "SETTLED"  },
];

export default function WavesPage() {
  const { isLoading: authLoading } = useAuthGuard();
  const [status, setStatus] = useState<WaveStatus | "">("");

  const { data: waves, isLoading, error } = useQuery({
    queryKey: ["waves", status],
    queryFn:  () => api.waves.list(status || undefined),
    enabled:  !authLoading,
  });

  if (authLoading) return <PageSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#f0f0f4]">Waves</h1>
          <p className="text-sm text-[#55556a] mt-0.5">Browse active contribution cycles</p>
        </div>

        <div className="flex items-center gap-1 bg-[#111118] border border-[#27272e] rounded-lg p-1">
          {FILTERS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setStatus(value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                status === value
                  ? "bg-[#27272e] text-[#f0f0f4]"
                  : "text-[#55556a] hover:text-[#8888a0]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <PageSpinner />}

      {error && (
        <div className="text-center py-16 text-[#8888a0]">
          <p className="text-sm">Failed to load waves.</p>
        </div>
      )}

      {waves && waves.length === 0 && (
        <div className="text-center py-16 border border-dashed border-[#27272e] rounded-xl">
          <p className="text-sm text-[#55556a]">No waves found.</p>
        </div>
      )}

      {waves && waves.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {waves.map((wave) => <WaveCard key={wave.id} wave={wave} />)}
        </div>
      )}
    </div>
  );
}
