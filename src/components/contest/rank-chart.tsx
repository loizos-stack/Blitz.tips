"use client";

import { format } from "date-fns";
import type { RankPoint } from "@/lib/contest";

// A self-contained (no external chart lib), theme-aware line chart of an
// entrant's ROI rank over time. Rank is inverted so #1 sits at the top. Colours
// come from `currentColor`, so the accent text colour on the wrapper drives the
// stroke/fill in both light and dark themes.
export function RankChart({ points }: { points: RankPoint[] }) {
  if (points.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-muted">
        No rank history yet — it appears once this entrant has a graded pick.
      </div>
    );
  }

  const W = 660;
  const H = 260;
  const padL = 40;
  const padR = 18;
  const padT = 18;
  const padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const n = points.length;
  const maxRank = Math.max(...points.map((p) => p.rank), 1);
  const span = Math.max(1, maxRank - 1);

  const x = (i: number) => (n === 1 ? padL + innerW / 2 : padL + (i / (n - 1)) * innerW);
  const y = (rank: number) => padT + ((rank - 1) / span) * innerH;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.rank).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${x(n - 1).toFixed(1)},${(padT + innerH).toFixed(1)} L${x(0).toFixed(1)},${(
    padT + innerH
  ).toFixed(1)} Z`;

  const current = points[points.length - 1];
  const best = points.reduce((a, b) => (b.rank < a.rank ? b : a));

  // Y gridlines: rank 1, the midpoint, and the worst rank in view.
  const rankTicks = Array.from(new Set([1, Math.round((1 + maxRank) / 2), maxRank])).filter((r) => r >= 1);

  return (
    <div className="card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">Rank over time</p>
        <div className="flex gap-2 text-xs">
          <span className="rounded-full bg-accent/10 px-2 py-0.5 font-semibold text-accent">Now #{current.rank}</span>
          <span className="rounded-full bg-gold/10 px-2 py-0.5 font-semibold text-gold">Best #{best.rank}</span>
        </div>
      </div>
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[20rem] text-accent" role="img" aria-label="Rank over time">
          <defs>
            <linearGradient id="rankFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Gridlines + rank labels */}
          {rankTicks.map((r) => (
            <g key={r}>
              <line
                x1={padL}
                x2={W - padR}
                y1={y(r)}
                y2={y(r)}
                className="stroke-border"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text x={padL - 8} y={y(r) + 4} textAnchor="end" className="fill-muted" style={{ fontSize: 11 }}>
                #{r}
              </text>
            </g>
          ))}

          {/* Area + line */}
          {n > 1 && <path d={areaPath} fill="url(#rankFill)" />}
          <path d={linePath} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

          {/* Point markers */}
          {points.map((p, i) => (
            <circle key={p.t} cx={x(i)} cy={y(p.rank)} r={n > 40 ? 1.6 : 3} fill="currentColor">
              <title>
                {format(new Date(p.t), "MMM d")}: #{p.rank} of {p.of}
                {p.roi != null ? ` · ${p.roi > 0 ? "+" : ""}${p.roi.toFixed(1)}% ROI` : ""}
              </title>
            </circle>
          ))}

          {/* X axis end labels */}
          <text x={padL} y={H - 8} textAnchor="start" className="fill-muted" style={{ fontSize: 11 }}>
            {format(new Date(points[0].t), "MMM d")}
          </text>
          {n > 1 && (
            <text x={W - padR} y={H - 8} textAnchor="end" className="fill-muted" style={{ fontSize: 11 }}>
              {format(new Date(current.t), "MMM d")}
            </text>
          )}
        </svg>
      </div>
      <p className="mt-2 text-xs text-muted">ROI rank among all entrants with a graded pick (#1 = best). No min-pick floor.</p>
    </div>
  );
}
