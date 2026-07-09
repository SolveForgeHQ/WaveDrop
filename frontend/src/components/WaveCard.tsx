import Link from "next/link";
import { Card } from "./ui/Card";
import { Badge } from "./ui/Badge";
import type { Wave, WaveStatus } from "../lib/api";

const statusVariant: Record<WaveStatus, "success" | "accent" | "warning" | "muted"> = {
  ACTIVE:   "success",
  UPCOMING: "accent",
  CLOSED:   "warning",
  SETTLED:  "muted",
};

const statusLabel: Record<WaveStatus, string> = {
  ACTIVE: "Active", UPCOMING: "Upcoming", CLOSED: "Closed", SETTLED: "Settled",
};

export function WaveCard({ wave }: { wave: Wave }) {
  const end = new Date(wave.endsAt);
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86_400_000));

  return (
    <Link href={`/waves/${wave.id}`}>
      <Card className="hover:border-[#3a3a48] transition-colors cursor-pointer h-full">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-[#55556a] mb-1">{wave.ecosystem.name}</p>
            <h3 className="text-sm font-semibold text-[#f0f0f4]">{wave.name}</h3>
          </div>
          <Badge variant={statusVariant[wave.status]}>{statusLabel[wave.status]}</Badge>
        </div>

        {wave.description && (
          <p className="text-xs text-[#8888a0] mb-4 line-clamp-2">{wave.description}</p>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-[#27272e]">
          <div>
            <p className="text-xs text-[#55556a]">Pool</p>
            <p className="text-sm font-semibold text-[#f0f0f4]">${wave.poolAmountUsdc} USDC</p>
          </div>
          {wave.status === "ACTIVE" && (
            <div className="text-right">
              <p className="text-xs text-[#55556a]">Ends in</p>
              <p className="text-sm font-medium text-[#f0f0f4]">{daysLeft}d</p>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}
