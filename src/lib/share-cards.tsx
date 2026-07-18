import type { ReactElement } from "react";
import type { PickResult } from "@prisma/client";

// Branded 1200×630 social cards, rendered to PNG via next/og (Satori). Shared by
// the profile's opengraph-image (a handicapper's verified record) and the pick
// share route (a single settled play). Satori rules to keep in mind here: every
// element with more than one child needs an explicit `display: "flex"`, and we
// avoid emoji/remote fonts so nothing triggers a network fetch at render time.

export const SHARE_CARD_SIZE = { width: 1200, height: 630 };

const BG = "linear-gradient(135deg, #0a1410 0%, #0d1f16 55%, #123524 100%)";
const ACCENT = "#22c55e";
const MUTED = "#94a3b8";

function Wordmark(): ReactElement {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: "#16a34a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 34,
          fontWeight: 800,
          color: "#0a1410",
        }}
      >
        B
      </div>
      <div style={{ display: "flex", marginLeft: 16, fontSize: 38, fontWeight: 800, letterSpacing: -1 }}>
        <span>Blitz</span>
        <span style={{ color: ACCENT }}>.tips</span>
      </div>
    </div>
  );
}

function Monogram({ name }: { name: string }): ReactElement {
  return (
    <div
      style={{
        width: 120,
        height: 120,
        borderRadius: 60,
        background: "#16a34a",
        border: "4px solid rgba(255,255,255,0.14)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 52,
        fontWeight: 800,
        color: "#0a1410",
        textTransform: "uppercase",
      }}
    >
      {name.slice(0, 2)}
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: string; tone?: string }): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 18,
        padding: "24px 26px",
      }}
    >
      <span style={{ fontSize: 24, color: MUTED }}>{label}</span>
      <span style={{ fontSize: 52, fontWeight: 800, color: tone ?? "#f8fafc", marginTop: 6 }}>{value}</span>
    </div>
  );
}

function americanOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

export interface RecordCardData {
  displayName: string;
  handle: string;
  record: string;
  unitsNet: number;
  roi: number | null;
  winRate: number | null;
  totalPicks: number;
  sports: string[];
}

export function recordCard(d: RecordCardData): ReactElement {
  const units = `${d.unitsNet >= 0 ? "+" : ""}${d.unitsNet.toFixed(1)}u`;
  const tone = d.unitsNet >= 0 ? ACCENT : "#f87171";
  const subtitle = [d.sports.slice(0, 4).join(" · "), `${d.totalPicks} tracked picks`]
    .filter(Boolean)
    .join("   •   ");

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: 72, background: BG, color: "#f8fafc", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Wordmark />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "rgba(34,197,94,0.14)",
            border: "1px solid rgba(34,197,94,0.4)",
            borderRadius: 999,
            padding: "10px 20px",
            fontSize: 22,
            fontWeight: 700,
            color: ACCENT,
            letterSpacing: 1,
          }}
        >
          VERIFIED RECORD
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", marginTop: 40 }}>
        <Monogram name={d.displayName} />
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 28 }}>
          <span style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.05 }}>{d.displayName}</span>
          <span style={{ fontSize: 30, color: MUTED, marginTop: 4 }}>@{d.handle}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 20, marginTop: 44 }}>
        <StatTile label="Record" value={d.record} />
        <StatTile label="Net units" value={units} tone={tone} />
        <StatTile label="ROI" value={d.roi !== null ? `${d.roi.toFixed(0)}%` : "—"} />
        <StatTile label="Win rate" value={d.winRate !== null ? `${d.winRate.toFixed(0)}%` : "—"} />
      </div>

      <div style={{ display: "flex", marginTop: "auto", fontSize: 24, color: MUTED }}>
        <span>{subtitle || "Every pick tracked & graded on Blitz.tips"}</span>
      </div>
    </div>
  );
}

export interface PickCardData {
  displayName: string;
  handle: string;
  sportLabel: string;
  matchup: string;
  selection: string;
  odds: number;
  units: number;
  result: PickResult;
}

const RESULT_STYLE: Record<PickResult, { label: string; color: string; bg: string; border: string }> = {
  WIN: { label: "WIN", color: "#22c55e", bg: "rgba(34,197,94,0.14)", border: "rgba(34,197,94,0.4)" },
  LOSS: { label: "LOSS", color: "#f87171", bg: "rgba(248,113,113,0.14)", border: "rgba(248,113,113,0.4)" },
  PUSH: { label: "PUSH", color: MUTED, bg: "rgba(148,163,184,0.14)", border: "rgba(148,163,184,0.4)" },
  VOID: { label: "VOID", color: MUTED, bg: "rgba(148,163,184,0.14)", border: "rgba(148,163,184,0.4)" },
  PENDING: { label: "PENDING", color: "#fbbf24", bg: "rgba(251,191,36,0.14)", border: "rgba(251,191,36,0.4)" },
};

export function pickCard(d: PickCardData): ReactElement {
  const r = RESULT_STYLE[d.result];

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: 72, background: BG, color: "#f8fafc", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Wordmark />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: r.bg,
            border: `1px solid ${r.border}`,
            borderRadius: 999,
            padding: "10px 24px",
            fontSize: 26,
            fontWeight: 800,
            color: r.color,
            letterSpacing: 1,
          }}
        >
          {r.label}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", marginTop: 44 }}>
        <span style={{ fontSize: 26, color: MUTED }}>
          {d.displayName} · @{d.handle} · {d.sportLabel}
        </span>
        <span style={{ fontSize: 40, fontWeight: 700, color: "#cbd5e1", marginTop: 18 }}>{d.matchup}</span>
        <span style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.08, marginTop: 10 }}>{d.selection}</span>
      </div>

      <div style={{ display: "flex", gap: 20, marginTop: 40 }}>
        <StatTile label="Odds" value={americanOdds(d.odds)} />
        <StatTile label="Units" value={`${d.units}u`} />
      </div>

      <div style={{ display: "flex", marginTop: "auto", fontSize: 24, color: MUTED }}>
        <span>Posted before kickoff · tracked & graded on Blitz.tips</span>
      </div>
    </div>
  );
}
