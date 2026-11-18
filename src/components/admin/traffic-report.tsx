"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Globe, FileText, Link2, MonitorSmartphone, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Breakdown, DayPoint, RangeTotals } from "@/lib/traffic";

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

/** A country code to a flag, by offsetting into the regional-indicator block. */
function flag(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "🌐";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function Delta({ now, before }: { now: number; before: number }) {
  // No previous data is not a 100% rise; it is nothing to compare against.
  if (before === 0) return <span className="text-xs text-muted">no earlier data</span>;
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return <span className="text-xs text-muted">level</span>;
  return (
    <span className={cn("text-xs font-medium", pct > 0 ? "text-accent" : "text-danger")}>
      {pct > 0 ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

/**
 * Views and visitors per day.
 *
 * Drawn as plain divs rather than pulled in as a charting library: it is two
 * series of bars, and the dependency would weigh more than the feature.
 */
function DailyChart({ points }: { points: DayPoint[] }) {
  if (points.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">Nothing recorded in this window yet.</p>;
  }
  const peak = Math.max(...points.map((p) => p.views), 1);
  return (
    <div className="flex h-40 items-end gap-0.5">
      {points.map((p) => (
        // Capped so a window with one or two days of data draws bars rather
        // than a single block filling the panel.
        <div key={p.day} className="group relative max-w-16 flex-1">
          <div
            className="w-full rounded-t bg-accent/25 transition group-hover:bg-accent/40"
            style={{ height: `${Math.max((p.views / peak) * 150, 2)}px` }}
          />
          {/* The visitor count inside the view count, so the gap between them
              is readable at a glance. */}
          <div
            className="absolute bottom-0 w-full rounded-t bg-accent"
            style={{ height: `${Math.max((p.visitors / peak) * 150, 1)}px` }}
          />
          <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-surface px-2 py-1 text-xs shadow-lg group-hover:block">
            <p className="font-medium">{p.day}</p>
            <p className="text-muted">
              {p.views} view{p.views === 1 ? "" : "s"} · {p.visitors} visitor
              {p.visitors === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function BreakdownCard({
  title,
  icon,
  rows,
  empty,
  render,
}: {
  title: string;
  icon: React.ReactNode;
  rows: Breakdown[];
  empty: string;
  render?: (label: string) => React.ReactNode;
}) {
  const peak = Math.max(...rows.map((r) => r.views), 1);
  return (
    <div className="card p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        {icon} {title}
      </h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-1">
          {rows.map((r) => (
            <li key={r.label} className="relative overflow-hidden rounded px-2 py-1.5">
              {/* The bar is the background, so the label stays readable at any
                  width rather than being pushed around by it. */}
              <div
                className="absolute inset-y-0 left-0 rounded bg-accent/10"
                style={{ width: `${(r.views / peak) * 100}%` }}
                aria-hidden
              />
              <div className="relative flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{render ? render(r.label) : r.label}</span>
                <span className="shrink-0 tabular-nums text-muted">
                  {r.views}
                  <span className="ml-2 text-xs">({r.visitors})</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TrafficReportView({
  days,
  totals,
  previousTotals,
  perDay,
  pages,
  referrers,
  countries,
  devices,
  retentionDays,
}: {
  days: number;
  totals: RangeTotals;
  previousTotals: RangeTotals;
  perDay: DayPoint[];
  pages: Breakdown[];
  referrers: Breakdown[];
  countries: Breakdown[];
  devices: Breakdown[];
  retentionDays: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const current = Number(params.get("days")) || days;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Traffic</h1>
          <p className="mt-1 text-sm text-muted">
            Counted first-party, without cookies. Kept for {retentionDays} days.
          </p>
        </div>
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => router.push(`/admin/traffic?days=${r.days}`)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium",
                current === r.days
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-muted hover:text-foreground"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Page views</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{totals.views.toLocaleString()}</p>
          <Delta now={totals.views} before={previousTotals.views} />
        </div>
        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Visitors</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{totals.visitors.toLocaleString()}</p>
          <Delta now={totals.visitors} before={previousTotals.visitors} />
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold">By day</h2>
        <p className="mt-0.5 text-xs text-muted">
          Solid is visitors, pale is page views. Hover a bar for the numbers.
        </p>
        <div className="mt-4">
          <DailyChart points={perDay} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownCard
          title="Pages"
          icon={<FileText className="h-4 w-4" />}
          rows={pages}
          empty="No pages recorded yet."
        />
        <BreakdownCard
          title="Referrers"
          icon={<Link2 className="h-4 w-4" />}
          rows={referrers}
          empty="No referrers yet."
          render={(label) =>
            label === "(direct)" ? <span className="text-muted">Direct / none</span> : label
          }
        />
        <BreakdownCard
          title="Countries"
          icon={<Globe className="h-4 w-4" />}
          rows={countries}
          empty="No country data yet — it comes from the edge, so it's absent locally."
          render={(label) =>
            label === "(direct)" ? (
              <span className="text-muted">Unknown</span>
            ) : (
              <span>
                {flag(label)} {label}
              </span>
            )
          }
        />
        <BreakdownCard
          title="Devices"
          icon={<MonitorSmartphone className="h-4 w-4" />}
          rows={devices}
          empty="No device data yet."
          render={(label) => <span className="capitalize">{label}</span>}
        />
      </div>

      <p className="flex items-start gap-2 text-xs text-muted">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Each row shows page views, with visitors in brackets. A visitor is identified by a digest
        that changes at midnight, so somebody who returns on a later day counts again — over a
        30-day window &ldquo;visitors&rdquo; means visits by distinct people per day, not distinct
        people overall. Admin pages and known bots are excluded.
      </p>
    </div>
  );
}
