"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Trophy, Plus, Check, ShieldAlert, Ban, Trash2 } from "lucide-react";
import { formatCents, SPORT_LABELS, cn } from "@/lib/utils";

type PendingPick = {
  id: string;
  entrantName: string;
  sport: string;
  matchup: string;
  selection: string;
  odds: number;
  units: number;
  eventStartsAt: string;
};

type Entry = {
  id: string;
  name: string;
  rank: number | null;
  roi: number | null;
  unitsNet: number;
  record: string;
  settledPicks: number;
  qualified: boolean;
  projectedPrizeCents: number;
  finalRank: number | null;
  prizeCents: number | null;
  paidAt: string | null;
  disqualified: boolean;
  disqualifiedReason: string | null;
  flagged: boolean;
  sharedPeers: number;
};

type SharedIp = {
  ip: string;
  entries: { entryId: string; name: string; hits: number }[];
};

type Contest = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  status: "DRAFT" | "OPEN" | "CLOSED" | "SETTLED";
  minPicks: number;
  startsAt: string;
  endsAt: string;
  prizePoolCents: number;
  prizeSplitDollars: number[];
  entryCount: number;
  pendingPicks: PendingPick[];
  sharedIps: SharedIp[];
  entries: Entry[];
};

const RESULTS = ["WIN", "LOSS", "PUSH", "VOID"] as const;
const STATUSES = ["DRAFT", "OPEN", "CLOSED", "SETTLED"] as const;

// Turn an ISO timestamp into the value a datetime-local input expects.
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ContestManager({
  contests,
  defaultSplitDollars,
}: {
  contests: Contest[];
  defaultSplitDollars: number[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editing = editingId && editingId !== "new" ? contests.find((c) => c.id === editingId) : null;

  const blank = {
    id: "",
    name: "",
    slug: "",
    tagline: "",
    status: "DRAFT" as Contest["status"],
    minPicks: 20,
    startsAt: "",
    endsAt: "",
    splitText: defaultSplitDollars.join("\n"),
  };
  const [form, setForm] = useState(blank);

  function openEditor(c: Contest | null) {
    setError(null);
    if (c) {
      setForm({
        id: c.id,
        name: c.name,
        slug: c.slug,
        tagline: c.tagline ?? "",
        status: c.status,
        minPicks: c.minPicks,
        startsAt: toLocalInput(c.startsAt),
        endsAt: toLocalInput(c.endsAt),
        splitText: c.prizeSplitDollars.join("\n"),
      });
      setEditingId(c.id);
    } else {
      setForm(blank);
      setEditingId("new");
    }
  }

  const splitDollars = form.splitText
    .split(/[\n,]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  const poolPreview = splitDollars.reduce((a, b) => a + b, 0);

  async function save() {
    setError(null);
    setBusy(true);
    const res = await fetch("/api/admin/contests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: form.id || undefined,
        name: form.name,
        slug: form.slug,
        tagline: form.tagline,
        status: form.status,
        minPicks: form.minPicks,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : "",
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : "",
        prizeSplitDollars: splitDollars,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(body.error ?? "Save failed");
    setEditingId(null);
    router.refresh();
  }

  async function gradePick(pickId: string, result: string) {
    setBusy(true);
    await fetch(`/api/admin/contest-picks/${pickId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result }),
    });
    setBusy(false);
    router.refresh();
  }

  async function settle(contestId: string) {
    if (!confirm("Settle this contest? This writes final ranks and prizes from the current graded picks.")) return;
    setBusy(true);
    await fetch(`/api/admin/contests/${contestId}/settle`, { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  async function togglePaid(entryId: string, paid: boolean) {
    setBusy(true);
    await fetch(`/api/admin/contest-entries/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid }),
    });
    setBusy(false);
    router.refresh();
  }

  async function toggleDisqualified(entryId: string, disqualified: boolean) {
    let reason: string | null = null;
    if (disqualified) {
      reason = prompt("Reason for disqualification (optional):", "Duplicate account / shared IP");
      if (reason === null) return; // cancelled
    }
    setBusy(true);
    await fetch(`/api/admin/contest-entries/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disqualified, reason }),
    });
    setBusy(false);
    router.refresh();
  }

  // Remove an entry entirely (e.g. someone joined by mistake). Deletes the entry
  // and, by cascade, its picks and IP logs — the user's opt-in is fully reset so
  // they can join again. Unlike disqualify, nothing is kept.
  async function removeEntry(entryId: string, name: string) {
    if (!confirm(`Remove ${name}'s entry entirely? This deletes their picks and resets their opt-in so they can join again.`)) {
      return;
    }
    setBusy(true);
    await fetch(`/api/admin/contest-entries/${entryId}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Trophy className="h-5 w-5 text-gold" /> Contests
          </h2>
          <p className="text-sm text-muted">Create contests, grade picks, settle winners, and track payouts.</p>
        </div>
        <button
          type="button"
          onClick={() => openEditor(null)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New contest
        </button>
      </div>

      {/* Editor */}
      {editingId && (
        <div className="card p-5">
          <p className="font-semibold">{editing ? `Edit: ${editing.name}` : "New contest"}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <input className={inp} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Slug (URL)">
              <input className={inp} value={form.slug} placeholder="supercapper" onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            </Field>
            <Field label="Tagline">
              <input className={inp} value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
            </Field>
            <Field label="Status">
              <select className={inp} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Contest["status"] })}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Starts at">
              <input type="datetime-local" className={inp} value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
            </Field>
            <Field label="Ends at">
              <input type="datetime-local" className={inp} value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
            </Field>
            <Field label="Min picks to qualify">
              <input type="number" min={1} className={inp} value={form.minPicks} onChange={(e) => setForm({ ...form, minPicks: Number(e.target.value) })} />
            </Field>
            <Field label={`Prize ladder — $ per place, one per line (pool: ${formatCents(poolPreview * 100)}). Payouts are ICM-smoothed from this at settle.`}>
              <textarea rows={4} className={inp} value={form.splitText} onChange={(e) => setForm({ ...form, splitText: e.target.value })} />
            </Field>
          </div>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          <div className="mt-4 flex gap-3">
            <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-muted">
              Cancel
            </button>
            <button type="button" onClick={save} disabled={busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60">
              {busy ? "Saving…" : "Save contest"}
            </button>
          </div>
        </div>
      )}

      {/* Contest list */}
      {contests.length === 0 && !editingId && (
        <div className="card p-8 text-center text-muted">No contests yet — create your first one.</div>
      )}

      {contests.map((c) => (
        <div key={c.id} className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 font-semibold">
                {c.name}
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", statusClass(c.status))}>{c.status}</span>
              </p>
              <p className="text-xs text-muted">
                /{c.slug} · {format(new Date(c.startsAt), "MMM d, yyyy")}–{format(new Date(c.endsAt), "MMM d, yyyy")} ·{" "}
                {formatCents(c.prizePoolCents)} · {c.entryCount} entries · {c.pendingPicks.length} picks to grade
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => openEditor(c)} className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-muted">
                Edit
              </button>
              <button type="button" onClick={() => settle(c.id)} disabled={busy} className="rounded-lg bg-gold/90 px-3 py-1.5 text-sm font-semibold text-white hover:bg-gold disabled:opacity-60">
                Settle
              </button>
            </div>
          </div>

          {/* Pending picks to grade */}
          {c.pendingPicks.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Picks to grade ({c.pendingPicks.length})</p>
              <div className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {c.pendingPicks.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <span className="font-medium">{p.entrantName}</span>{" "}
                      <span className="text-muted">· {SPORT_LABELS[p.sport] ?? p.sport} · {p.matchup} · {p.selection} @ {p.odds} · {p.units}u</span>
                    </div>
                    <div className="flex gap-1.5">
                      {RESULTS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          disabled={busy}
                          onClick={() => gradePick(p.id, r)}
                          className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted hover:text-foreground disabled:opacity-50"
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Integrity — shared IPs / duplicate people */}
          {c.sharedIps.length > 0 && (
            <div className="mt-4 rounded-lg border border-danger/30 bg-danger/5 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-danger">
                <ShieldAlert className="h-4 w-4" /> Duplicate / shared IPs ({c.sharedIps.length})
              </p>
              <p className="mt-1 text-xs text-muted">
                These IPs were used by more than one entry — a sign of duplicate accounts or colluding entrants. Review
                and disqualify below.
              </p>
              <div className="mt-2 flex flex-col gap-1.5">
                {c.sharedIps.map((cluster) => (
                  <div key={cluster.ip} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <span className="rounded bg-surface-raised px-1.5 py-0.5 font-mono">{cluster.ip}</span>
                    <span className="text-muted">→</span>
                    {cluster.entries.map((en) => (
                      <span key={en.entryId} className="rounded-full bg-danger/10 px-2 py-0.5 font-medium text-danger">
                        {en.name} ({en.hits})
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Standings / winners */}
          {c.entries.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[38rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Entrant</th>
                    <th className="px-3 py-2 text-right">ROI</th>
                    <th className="px-3 py-2 text-right">Units</th>
                    <th className="px-3 py-2 text-right">Graded</th>
                    <th className="px-3 py-2 text-right">Prize</th>
                    <th className="px-3 py-2 text-right">Paid</th>
                    <th className="px-3 py-2 text-right">Integrity</th>
                  </tr>
                </thead>
                <tbody>
                  {c.entries.map((e) => {
                    const prize = e.prizeCents ?? e.projectedPrizeCents;
                    return (
                      <tr key={e.id} className={cn("border-b border-border last:border-b-0", e.disqualified && "opacity-55")}>
                        <td className="px-3 py-2 font-semibold text-muted">{e.disqualified ? "—" : e.finalRank ?? e.rank ?? "—"}</td>
                        <td className="px-3 py-2 font-medium">
                          <span className="flex items-center gap-1.5">
                            {e.flagged && !e.disqualified && (
                              <span title={`Shares an IP with ${e.sharedPeers} other entr${e.sharedPeers === 1 ? "y" : "ies"}`}>
                                <ShieldAlert className="h-3.5 w-3.5 text-danger" />
                              </span>
                            )}
                            <span className={cn(e.disqualified && "line-through")}>{e.name}</span>
                            {e.disqualified && <span className="rounded-full bg-danger/15 px-1.5 text-[10px] font-semibold text-danger">DQ</span>}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{e.roi != null ? `${e.roi > 0 ? "+" : ""}${e.roi.toFixed(1)}%` : "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{e.unitsNet > 0 ? "+" : ""}{e.unitsNet}u</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted">{e.qualified ? e.settledPicks : `${e.settledPicks}/${c.minPicks}`}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-gold">{prize > 0 ? formatCents(prize) : "—"}</td>
                        <td className="px-3 py-2 text-right">
                          {(e.prizeCents ?? 0) > 0 ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => togglePaid(e.id, !e.paidAt)}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                                e.paidAt ? "bg-accent/15 text-accent" : "border border-border text-muted hover:text-foreground"
                              )}
                            >
                              {e.paidAt ? <><Check className="h-3 w-3" /> Paid</> : "Mark paid"}
                            </button>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => toggleDisqualified(e.id, !e.disqualified)}
                              title={e.disqualifiedReason ?? undefined}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                                e.disqualified
                                  ? "border border-border text-muted hover:text-foreground"
                                  : "text-danger hover:bg-danger/10"
                              )}
                            >
                              {e.disqualified ? "Reinstate" : <><Ban className="h-3 w-3" /> Disqualify</>}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => removeEntry(e.id, e.name)}
                              title="Delete this entry and reset the user's opt-in"
                              className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted hover:border-danger hover:text-danger"
                            >
                              <Trash2 className="h-3 w-3" /> Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const inp = "mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-muted">
      {label}
      {children}
    </label>
  );
}

function statusClass(status: Contest["status"]): string {
  switch (status) {
    case "OPEN":
      return "bg-accent/15 text-accent";
    case "SETTLED":
      return "bg-gold/15 text-gold";
    case "CLOSED":
      return "bg-danger/15 text-danger";
    default:
      return "bg-surface-raised text-muted";
  }
}
