"use client";
import { useAuthGuard } from "../../lib/useAuthGuard";
import { PageSpinner }  from "../../components/ui/Spinner";

export default function HistoryPage() {
  const { isLoading } = useAuthGuard();
  if (isLoading) return <PageSpinner />;
  return (
    <div>
      <h1 className="text-xl font-bold text-[#f0f0f4] mb-2">History</h1>
      <p className="text-sm text-[#55556a]">Your full contribution history and past wave payouts — coming soon.</p>
    </div>
  );
}
