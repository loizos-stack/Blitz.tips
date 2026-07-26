"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ShieldAlert, Ban, Trash2, Fingerprint, Network, UserX, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IntegrityOverview } from "@/lib/integrity";

export function IntegrityViewer({ overview }: { overview: IntegrityOverview }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");

  const { totals, sharedIps, recent } = overview;

  async function disqualify(entryId: string) {
    const reason = prompt("Reason for disqualification (optional):", "Duplicate account / shared IP");
    if (reason === null) return; // cancelled
    setBusy(true);
    await fetch(`/api/admin/contest-entries/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disqualified: true, reason }),
    });
    setBusy(false);
    router.refresh();
  }

  async function remove(entryId: string, name: string) {
    if (!confirm(`Remove ${name}'s entry entirely? This deletes their picks and IP logs and resets their opt-in so they can join again.`)) {
      return;
    }
    setBusy(true);
    await fetch(`/api/admin/contest-entries/${entryId}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recent;
    return recent.filter(
      (r) =>
        r.ip.toLowerCase().includes(q) ||
        r.entrantName.toLowerCase().includes(q) ||
        r.contestName.toLowerCase().includes(q) ||
        r.action.toLowerCase().includes(q) ||
        (r.userAgent ?? "").toLowerCase().includes(q)
    );
  }, [query, recent]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <ShieldAlert className="h-5 w-5 text-danger" /> Integrity
        </h2>
        <p className="text-sm text-muted">
          IP and device signals logged whenever an entrant joins a contest or submits a pick. Shared IPs across entries
          are the primary duplicate-account / collusion signal.
        </p>
      </div>

      {/* Headline tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat icon={<ListChecks className="h-4 w-4" />} label="Logged events" value={totals.events} />
        <Stat icon={<Network className="h-4 w-4" />} label="Distinct IPs" value={totals.distinctIps} />
        <Stat icon={<Fingerprint className="h-4 w-4" />} label="Shared IPs" value={totals.sharedIps} tone={totals.sharedIps > 0 ? "danger" : undefined} />
        <Stat icon={<ShieldAlert className="h-4 w-4" />} label="Flagged entries" value={totals.flaggedEntries} tone={totals.flaggedEntries > 0 ? "danger" : undefined} />
        <Stat icon={<UserX className="h-4 w-4" />} label="Disqualified" value={totals.disqualifiedEntries} />
        <Stat icon={<ListChecks className="h-4 w-4" />} label="Total entries" value={totals.totalEntries} />
      </div>

      {/* Shared IP clusters */}
      <div className="card p-5">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Fingerprint className="h-4 w-4 text-danger" /> Shared IPs / duplicate people ({sharedIps.length})
        </p>
        <p className="mt-1 text-xs text-muted">
          Each IP below was used by more than one entry. Review, then disqualify (keeps the record, out of the money) or
          remove (deletes the entry and resets the opt-in).
        </p>
        {sharedIps.length === 0 ? (
          <p className="mt-4 rounded-lg border border-border bg-surface-raised px-3 py-6 text-center text-sm text-muted">
            No shared IPs detected — every entry has used a distinct address.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {sharedIps.map((cluster) => (
              <div key={cluster.ip} className="rounded-lg border border-danger/30 bg-danger/5 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded bg-surface-raised px-1.5 py-0.5 font-mono">{cluster.ip}</span>
                  <span className="text-muted">used by {cluster.entries.length} entries</span>
                  {cluster.lastSeen && (
                    <span className="text-muted">· last seen {format(new Date(cluster.lastSeen), "MMM d, HH:mm")}</span>
                  )}
                </div>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[34rem] text-sm">
                    <tbody>
                      {cluster.entries.map((en) => (
                        <tr key={en.entryId} className="border-t border-danger/15">
                          <td className="py-1.5 pr-3">
                            <span className={cn("font-medium", en.disqualified && "text-muted line-through")}>{en.name}</span>
                            {en.disqualified && (
                              <span className="ml-1.5 rounded-full bg-danger/15 px-1.5 text-[10px] font-semibold text-danger">DQ</span>
                            )}
                          </td>
                          <td className="py-1.5 pr-3 text-xs text-muted">{en.contestName}</td>
                          <td className="py-1.5 pr-3 text-right text-xs tabular-nums text-muted">{en.hits} hits</td>
                          <td className="py-1.5 text-right">
                            <div className="flex justify-end gap-1.5">
                              {!en.disqualified && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => disqualify(en.entryId)}
                                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-danger hover:bg-danger/10 disabled:opacity-50"
                                >
                                  <Ban className="h-3 w-3" /> Disqualify
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => remove(en.entryId, en.name)}
                                className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted hover:border-danger hover:text-danger disabled:opacity-50"
                              >
                                <Trash2 className="h-3 w-3" /> Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Raw activity log */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <ListChecks className="h-4 w-4 text-accent" /> Activity log
            <span className="font-normal text-muted">
              ({filtered.length}{filtered.length !== recent.length ? ` of ${recent.length}` : ""})
            </span>
          </p>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by IP, name, contest, action, device…"
            className="w-full max-w-xs rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="mt-3 max-h-[32rem] overflow-auto rounded-lg border border-border">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Entrant</th>
                <th className="px-3 py-2">Contest</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">IP</th>
                <th className="px-3 py-2">Device</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted">
                    {recent.length === 0 ? "No integrity events logged yet." : "No events match your filter."}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-b-0">
                    <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-muted">
                      {format(new Date(r.createdAt), "MMM d, HH:mm:ss")}
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn("font-medium", r.disqualified && "text-muted line-through")}>{r.entrantName}</span>
                      {r.disqualified && (
                        <span className="ml-1.5 rounded-full bg-danger/15 px-1.5 text-[10px] font-semibold text-danger">DQ</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">{r.contestName}</td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-semibold",
                          r.action === "join" ? "bg-accent/15 text-accent" : "bg-surface-raised text-muted"
                        )}
                      >
                        {r.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.ip}</td>
                    <td className="max-w-[16rem] truncate px-3 py-2 text-xs text-muted" title={r.userAgent ?? undefined}>
                      {r.userAgent ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "danger";
}) {
  return (
    <div className="card p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
        {icon}
        {label}
      </p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", tone === "danger" ? "text-danger" : "text-foreground")}>
        {value}
      </p>
    </div>
  );
}
