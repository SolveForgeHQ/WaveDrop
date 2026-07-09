"use client";
import { useAuthGuard } from "../../../lib/useAuthGuard";
import { PageSpinner }  from "../../../components/ui/Spinner";

export default function ContributorIssuesPage() {
  const { isLoading } = useAuthGuard();
  if (isLoading) return <PageSpinner />;
  return (
    <div>
      <h1 className="text-xl font-bold text-[#f0f0f4] mb-2">My Issues</h1>
      <p className="text-sm text-[#55556a]">Issues you have applied for or are actively working on — coming soon.</p>
    </div>
  );
}
