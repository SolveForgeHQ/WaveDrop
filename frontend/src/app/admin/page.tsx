"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Wave } from "../../lib/api";
import { Card, CardHeader, CardTitle } from "../../components/ui/Card";
import { Button }    from "../../components/ui/Button";
import { Badge }     from "../../components/ui/Badge";
import { Input, Textarea, Label } from "../../components/ui/Input";
import { PageSpinner } from "../../components/ui/Spinner";

export default function AdminPage() {
  const qc = useQueryClient();

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["me"], queryFn: api.auth.me, retry: false,
  });

  const adminLogins = (process.env.NEXT_PUBLIC_ADMIN_LOGINS ?? "").split(",").map(s => s.trim());
  const isAdmin     = me && adminLogins.includes(me.githubLogin);

  if (meLoading) return <PageSpinner />;
  if (!me) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-[#55556a]">Sign in to access the admin panel.</p>
        <a href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/auth/github`}>
          <Button className="mt-4">Continue with GitHub</Button>
        </a>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-[#ef4444]">Access denied. Admin only.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-[#f0f0f4] mb-6">Admin</h1>

      <div className="space-y-6">
        <CreateWaveForm qc={qc} />
        <WaveList qc={qc} />
      </div>
    </div>
  );
}

// ── Create Wave Form ─────────────────────────────────────────────────────────

function CreateWaveForm({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const [form, setForm] = useState({
    ecosystemId: "", name: "", description: "",
    poolAmountUsdc: "", startsAt: "", endsAt: "",
  });

  const mutation = useMutation({
    mutationFn: () => api.waves.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["waves"] });
      setForm({ ecosystemId: "", name: "", description: "", poolAmountUsdc: "", startsAt: "", endsAt: "" });
    },
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <Card>
      <CardHeader><CardTitle>Create Wave</CardTitle></CardHeader>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Wave Name</Label>
          <Input placeholder="Wave #3 — Q3 2025" value={form.name} onChange={set("name")} />
        </div>
        <div className="col-span-2">
          <Label>Description</Label>
          <Textarea rows={2} placeholder="Optional description..." value={form.description} onChange={set("description")} />
        </div>
        <div>
          <Label>Ecosystem ID</Label>
          <Input placeholder="cuid..." value={form.ecosystemId} onChange={set("ecosystemId")} />
        </div>
        <div>
          <Label>Pool (USDC)</Label>
          <Input type="number" placeholder="10000" value={form.poolAmountUsdc} onChange={set("poolAmountUsdc")} />
        </div>
        <div>
          <Label>Starts At</Label>
          <Input type="datetime-local" value={form.startsAt} onChange={set("startsAt")} />
        </div>
        <div>
          <Label>Ends At</Label>
          <Input type="datetime-local" value={form.endsAt} onChange={set("endsAt")} />
        </div>
      </div>

      {mutation.error && (
        <p className="text-xs text-[#ef4444] mt-3">{mutation.error.message}</p>
      )}
      {mutation.isSuccess && (
        <p className="text-xs text-[#22c55e] mt-3">Wave created.</p>
      )}

      <div className="mt-4 flex justify-end">
        <Button
          variant="primary"
          onClick={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={!form.name || !form.poolAmountUsdc || !form.startsAt || !form.endsAt}
        >
          Create Wave
        </Button>
      </div>
    </Card>
  );
}

// ── Wave List with Close + Settle ─────────────────────────────────────────────

function WaveList({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const { data: waves, isLoading } = useQuery({
    queryKey: ["waves", ""],
    queryFn:  () => api.waves.list(),
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => api.waves.close(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["waves"] }),
  });

  if (isLoading) return <PageSpinner />;

  return (
    <Card>
      <CardHeader><CardTitle>All Waves</CardTitle></CardHeader>
      <div className="space-y-3">
        {!waves || waves.length === 0 ? (
          <p className="text-xs text-[#55556a]">No waves yet.</p>
        ) : (
          waves.map((wave) => <WaveAdminRow key={wave.id} wave={wave} closeMutation={closeMutation} qc={qc} />)
        )}
      </div>
    </Card>
  );
}

function WaveAdminRow({
  wave, closeMutation, qc,
}: {
  wave: Wave;
  closeMutation: ReturnType<typeof useMutation<{ message: string; merkleRoot: string; totalLeaves: number }, Error, string>>;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const [merkleRoot, setMerkleRoot] = useState("");
  const [onChainId,  setOnChainId]  = useState("");
  const [result, setResult]         = useState<{ merkleRoot: string; totalLeaves: number } | null>(null);

  const settleMutation = useMutation({
    mutationFn: () => api.waves.settle(wave.id, { merkleRoot, onChainWaveId: onChainId || undefined }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["waves"] }),
  });

  return (
    <div className="border border-[#27272e] rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm font-medium text-[#f0f0f4]">{wave.name}</p>
          <p className="text-xs text-[#55556a] font-mono mt-0.5">{wave.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={wave.status === "ACTIVE" ? "success" : "muted"}>{wave.status}</Badge>

          {wave.status === "ACTIVE" && (
            <Button
              size="sm" variant="danger"
              loading={closeMutation.isPending}
              onClick={() => closeMutation.mutate(wave.id, { onSuccess: (r) => setResult(r) })}
            >
              Close Wave
            </Button>
          )}
        </div>
      </div>

      {/* Show generated root after close */}
      {(result || wave.merkleRoot) && wave.status !== "SETTLED" && (
        <div className="mt-3 space-y-2">
          {result && (
            <div className="bg-[#22c55e10] border border-[#22c55e30] rounded-lg p-3 text-xs">
              <p className="text-[#22c55e] font-medium mb-1">
                ✓ Merkle tree generated — {result.totalLeaves} payouts
              </p>
              <p className="font-mono text-[#8888a0] break-all">{result.merkleRoot}</p>
            </div>
          )}

          <p className="text-xs text-[#55556a]">
            Submit this root on-chain via the operator script, then record it here:
          </p>
          <Input
            placeholder="0x Merkle root..."
            value={merkleRoot}
            onChange={(e) => setMerkleRoot(e.target.value)}
          />
          <Input
            placeholder="On-chain wave ID (bytes32 hex, optional)"
            value={onChainId}
            onChange={(e) => setOnChainId(e.target.value)}
          />
          <Button
            size="sm" variant="primary"
            onClick={() => settleMutation.mutate()}
            loading={settleMutation.isPending}
            disabled={!merkleRoot}
          >
            Mark as Settled
          </Button>
          {settleMutation.isSuccess && (
            <p className="text-xs text-[#22c55e]">Wave marked as settled.</p>
          )}
        </div>
      )}

      {wave.merkleRoot && wave.status === "SETTLED" && (
        <p className="text-xs font-mono text-[#55556a] mt-2 break-all">
          Root: {wave.merkleRoot}
        </p>
      )}
    </div>
  );
}
