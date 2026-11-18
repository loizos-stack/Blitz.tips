"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Trophy } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";
import { formatCents } from "@/lib/utils";

export interface PrizeAwardRow {
  id: string;
  rank: number;
  handle: string;
  displayName: string;
  prizeCents: number;
  unitsNet: number;
  record: string;
  paidAt: string | null;
}

export interface PrizeMonthRow {
  month: string;
  label: string;
  /** Has the month ended? Only then can it be recorded. */
  closed: boolean;
  awards: PrizeAwardRow[];
}

/**
 * Recording each month's winners and ticking them off as paid.
 *
 * Two separate actions on purpose. Recording freezes who won; paying is a bank
 * transfer that happens minutes or days later. Collapsing them into one button
 * would mean the board could not show "won, not yet paid" — which is exactly
 * the state someone will ask about.
 */
export function PrizeMonths({ months }: { months: PrizeMonthRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(body: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    const res = await fetchJson("/api/admin/prizes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(null);
    if (!res.ok) setError(res.error ?? "That didn't work.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-danger">{error}</p>}

      {months.map((m) => (
        <div key={m.month} className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
            <h3 className="flex items-center gap-2 font-semibold">
              <Trophy className="h-4 w-4 text-gold" /> {m.label}
            </h3>
            {m.awards.length === 0 ? (
              <button
                type="button"
                disabled={!m.closed || busy !== null}
                onClick={() => call({ action: "record", month: m.month }, m.month)}
                title={m.closed ? undefined : "The month hasn't finished yet."}
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy === m.month ? "Recording…" : "Record winners"}
              </button>
            ) : (
              <span className="text-xs text-muted">
                {m.awards.filter((a) => a.paidAt).length}/{m.awards.length} paid
              </span>
            )}
          </div>

          {m.awards.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">
              {m.closed
                ? "Not recorded yet. Recording freezes the standings as the winners."
                : "Still running — the live race is on the public leaderboard."}
            </p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {m.awards.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3 font-bold tabular-nums">#{a.rank}</td>
                    <td className="py-3">
                      <span className="font-medium">{a.displayName}</span>{" "}
                      <span className="text-muted">@{a.handle}</span>
                    </td>
                    <td className="py-3 text-right tabular-nums text-muted">
                      {a.unitsNet > 0 ? "+" : ""}
                      {a.unitsNet.toFixed(2)}u · {a.record}
                    </td>
                    <td className="py-3 text-right font-semibold tabular-nums">
                      {formatCents(a.prizeCents)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => call({ action: "paid", id: a.id }, a.id)}
                        className={
                          a.paidAt
                            ? "inline-flex items-center gap-1 rounded-lg border border-accent/40 px-2.5 py-1 text-xs font-medium text-accent"
                            : "rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:border-accent hover:text-accent"
                        }
                      >
                        {a.paidAt && <Check className="h-3 w-3" />}
                        {busy === a.id ? "…" : a.paidAt ? "Paid" : "Mark paid"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
