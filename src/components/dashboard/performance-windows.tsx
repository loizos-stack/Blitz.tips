"use client";

import { computeStats } from "@/lib/odds";
import { BreakdownTable } from "@/components/dashboard/breakdown-table";
import type { LabeledBreakdown } from "@/lib/analytics";
import type { PickResult } from "@prisma/client";

// A settled-pick reduced to what a record needs, plus its timeline date as an
// ISO string (server can't know the viewer's timezone, so "Today"/"Yesterday"
// are resolved here against the browser clock).
export type WindowPick = { odds: number; units: number; result: PickResult; date: string };

const DAY_MS = 24 * 60 * 60 * 1000;

export function PerformanceWindows({ picks }: { picks: WindowPick[] }) {
  const now = new Date();
  const nowMs = now.getTime();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - DAY_MS;
  const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

  // Half-open [start, end): `end` is exclusive so a pick can't land in two
  // adjacent windows (e.g. exactly midnight counts as "today", not "yesterday").
  const between = (startMs: number, endMs: number) =>
    picks.filter((p) => {
      const t = new Date(p.date).getTime();
      return t >= startMs && t < endMs;
    });
  const rolling = (days: number) => between(nowMs - days * DAY_MS, nowMs + 1);

  const rows: LabeledBreakdown[] = (
    [
      { key: "today", label: "Today", ps: between(startOfToday, nowMs + 1) },
      { key: "yesterday", label: "Yesterday", ps: between(startOfYesterday, startOfToday) },
      { key: "7d", label: "Last 7 days", ps: rolling(7) },
      { key: "14d", label: "Last 14 days", ps: rolling(14) },
      { key: "30d", label: "Last 30 days", ps: rolling(30) },
      { key: "90d", label: "Last 90 days", ps: rolling(90) },
      { key: "year", label: "This year", ps: between(startOfYear, nowMs + 1) },
      { key: "all", label: "All time", ps: picks },
    ] as const
  ).map(({ key, label, ps }) => ({ key, label, stats: computeStats(ps) }));

  return <BreakdownTable rows={rows} firstColumn="Period" />;
}
