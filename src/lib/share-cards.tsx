import type { ReactElement } from "react";
import type { PickResult } from "@prisma/client";

// Branded 1200×630 social cards, rendered to PNG via next/og (Satori). Styled to
// mirror the on-site handicapper cards: a light surface with a cover strip, the
// avatar overlapping it, sport chips, and the same six-stat grid. Satori rules:
// every element with >1 child needs display:flex, no negative margins (we use
// absolute positioning for the avatar overlap), and no emoji/remote fonts.

export const SHARE_CARD_SIZE = { width: 1200, height: 630 };

// Site theme (globals.css).
const CANVAS = "#eef1f5";
const SURFACE = "#ffffff";
const RAISED = "#f1f3f6";
const BORDER = "#e3e6eb";
const FG = "#13161c";
const MUTED = "#4b5563";
const ACCENT = "#16a34a";
const DANGER = "#dc2626";
const COVER = "linear-gradient(90deg, rgba(22,163,74,0.22) 0%, #eef2f6 55%, rgba(180,83,9,0.18) 100%)";

// The real Blitz.tips logo mark (kept in sync with public/logo-mark.svg): a green
// rounded square with the gold bolt. Inlined as a data URI so the card renders
// with zero network fetches (Satori rasterizes the SVG).
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none"><defs><linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fde047"/><stop offset="100%" stop-color="#eab308"/></linearGradient></defs><rect width="40" height="40" rx="10" fill="#16a34a"/><path d="M22 6 L11 23 H18.5 L16 35 L29 19 H21.5 L24 6 Z" fill="#fde047" fill-opacity="0.14" stroke="url(#gold)" stroke-width="2.6" stroke-linejoin="round"/></svg>`;
export const LOGO_MARK = `data:image/svg+xml;base64,${Buffer.from(LOGO_SVG).toString("base64")}`;

export function Wordmark({ size = 44 }: { size?: number }): ReactElement {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori (next/og) renders a plain <img>; data URI, no network */}
      <img src={LOGO_MARK} width={size} height={size} alt="" />
      <div style={{ display: "flex", marginLeft: 12, fontSize: size * 0.62, fontWeight: 800, letterSpacing: -1, color: FG }}>
        <span>Blitz</span>
        <span style={{ color: ACCENT }}>.tips</span>
      </div>
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
        background: RAISED,
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
        padding: "18px 18px",
      }}
    >
      <span style={{ fontSize: 20, color: MUTED }}>{label}</span>
      <span style={{ fontSize: 40, fontWeight: 800, color: tone ?? FG, marginTop: 4 }}>{value}</span>
    </div>
  );
}

function CardFrame({ children }: { children: ReactElement | ReactElement[] }): ReactElement {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", padding: 48, background: CANVAS, fontFamily: "sans-serif" }}>
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 28,
          boxShadow: "0 2px 10px rgba(16,24,40,0.06)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function americanOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

function formatStreak(streak: number): string {
  if (streak === 0) return "—";
  return streak > 0 ? `W${streak}` : `L${Math.abs(streak)}`;
}

export interface RecordCardData {
  displayName: string;
  handle: string;
  record: string;
  unitsNet: number;
  roi: number | null;
  winRate: number | null;
  streak: number;
  l10: string;
  totalPicks: number;
  sports: string[];
  // The handicapper's real profile photo and cover, pre-fetched to data URIs by
  // the route. Null → fall back to the initials monogram / gradient cover.
  avatarDataUri?: string | null;
  coverDataUri?: string | null;
}

export function recordCard(d: RecordCardData): ReactElement {
  const units = `${d.unitsNet >= 0 ? "+" : ""}${d.unitsNet.toFixed(1)}u`;
  const unitsTone = d.unitsNet >= 0 ? ACCENT : DANGER;

  return (
    <CardFrame>
      {/* Cover strip — the real cover image if present, else the brand gradient */}
      <div
        style={{
          position: "relative",
          display: "flex",
          height: 156,
          overflow: "hidden",
          background: COVER,
          borderTopLeftRadius: 27,
          borderTopRightRadius: 27,
        }}
      >
        {d.coverDataUri && (
          // eslint-disable-next-line @next/next/no-img-element -- Satori (next/og); data URI, no network
          <img
            src={d.coverDataUri}
            alt=""
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
      </div>

      {/* Avatar overlapping the cover — the real photo if present, else initials */}
      {d.avatarDataUri ? (
        // eslint-disable-next-line @next/next/no-img-element -- Satori (next/og); data URI, no network
        <img
          src={d.avatarDataUri}
          alt=""
          width={128}
          height={128}
          style={{
            position: "absolute",
            top: 92,
            left: 60,
            width: 128,
            height: 128,
            borderRadius: 64,
            border: "8px solid #ffffff",
            objectFit: "cover",
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            top: 92,
            left: 60,
            width: 128,
            height: 128,
            borderRadius: 64,
            background: ACCENT,
            border: "8px solid #ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 52,
            fontWeight: 800,
            color: "#ffffff",
            textTransform: "uppercase",
          }}
        >
          {d.displayName.slice(0, 2)}
        </div>
      )}

      {/* Body */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "0 60px 52px 60px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 78 }}>
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 150 }}>
            <span style={{ fontSize: 50, fontWeight: 800, color: FG, lineHeight: 1.05 }}>{d.displayName}</span>
            <span style={{ fontSize: 28, color: MUTED, marginTop: 2 }}>@{d.handle}</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "rgba(22,163,74,0.10)",
              border: "1px solid rgba(22,163,74,0.35)",
              borderRadius: 999,
              padding: "8px 18px",
              fontSize: 20,
              fontWeight: 700,
              color: ACCENT,
              letterSpacing: 1,
            }}
          >
            VERIFIED
          </div>
        </div>

        {/* Sport chips */}
        {d.sports.length > 0 && (
          <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
            {d.sports.slice(0, 5).map((s) => (
              <div
                key={s}
                style={{
                  display: "flex",
                  background: RAISED,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 999,
                  padding: "6px 16px",
                  fontSize: 22,
                  color: MUTED,
                }}
              >
                {s}
              </div>
            ))}
          </div>
        )}

        {/* Six-stat grid — matches the on-site handicapper card */}
        <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
          <StatTile label="Record" value={d.record} />
          <StatTile label="Win %" value={d.winRate !== null ? `${d.winRate.toFixed(0)}%` : "—"} />
          <StatTile label="Units" value={units} tone={unitsTone} />
          <StatTile label="ROI" value={d.roi !== null ? `${d.roi.toFixed(0)}%` : "—"} />
          <StatTile label="Streak" value={formatStreak(d.streak)} />
          <StatTile label="L10" value={d.l10} />
        </div>

        {/* Footer */}
        <div style={{ display: "flex", marginTop: "auto", alignItems: "center", justifyContent: "space-between" }}>
          <Wordmark />
          <span style={{ display: "flex", fontSize: 22, color: MUTED }}>
            {`${d.totalPicks} picks tracked & graded — verified`}
          </span>
        </div>
      </div>
    </CardFrame>
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
  // A still-locked premium pick renders a teaser that reveals nothing about the
  // play (no matchup/selection/odds) — just that a premium pick is live.
  locked?: boolean;

  // Everything below mirrors the card on the site. All optional: a pick with no
  // player, no league or no crest draws without that part rather than failing.
  /** "NFL", "EuroLeague" — the competition under the sport. */
  league?: string | null;
  /** Kickoff, already formatted by the caller. Satori has no Intl. */
  kickoff?: string | null;
  /** "Player Prop", "Moneyline" — the chip beside the player. */
  betTypeLabel?: string | null;
  playerName?: string | null;
  playerTeam?: string | null;
  /** Pre-fetched by the route; see lib/og-image. */
  playerPhotoDataUri?: string | null;
  awayLogoDataUri?: string | null;
  homeLogoDataUri?: string | null;
}

const GOLD = "#b45309";

function lockedPickCard(d: PickCardData): ReactElement {
  return (
    <CardFrame>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 104,
          padding: "0 44px",
          background: COVER,
          borderTopLeftRadius: 27,
          borderTopRightRadius: 27,
        }}
      >
        <Wordmark />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "rgba(180,83,9,0.10)",
            border: "1px solid rgba(180,83,9,0.35)",
            borderRadius: 999,
            padding: "8px 22px",
            fontSize: 24,
            fontWeight: 800,
            color: GOLD,
            letterSpacing: 1,
          }}
        >
          PREMIUM
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "44px 60px 52px 60px" }}>
        <span style={{ display: "flex", fontSize: 26, color: MUTED }}>
          {d.displayName} · @{d.handle} · {d.sportLabel}
        </span>
        <span style={{ display: "flex", fontSize: 66, fontWeight: 800, color: FG, marginTop: 16, lineHeight: 1.08 }}>
          New premium pick is live
        </span>
        <span style={{ display: "flex", fontSize: 34, color: MUTED, marginTop: 16 }}>
          Subscribe on Blitz.tips to unlock the play before it starts.
        </span>
        <div style={{ display: "flex", marginTop: "auto", fontSize: 22, color: MUTED }}>
          <span>Posted before kickoff · tracked &amp; graded on Blitz.tips</span>
        </div>
      </div>
    </CardFrame>
  );
}

const RESULT_STYLE: Record<PickResult, { label: string; color: string; bg: string; border: string }> = {
  WIN: { label: "WIN", color: ACCENT, bg: "rgba(22,163,74,0.10)", border: "rgba(22,163,74,0.35)" },
  LOSS: { label: "LOSS", color: DANGER, bg: "rgba(220,38,38,0.10)", border: "rgba(220,38,38,0.35)" },
  PUSH: { label: "PUSH", color: MUTED, bg: RAISED, border: BORDER },
  VOID: { label: "VOID", color: MUTED, bg: RAISED, border: BORDER },
  PENDING: { label: "PENDING", color: "#b45309", bg: "rgba(180,83,9,0.10)", border: "rgba(180,83,9,0.35)" },
};

/** The round player portrait, or their initials when no photo resolved. */
function PlayerAvatar({ src, name }: { src?: string | null; name: string }): ReactElement {
  // 88, not larger. The body is 430px tall once the header and frame padding
  // are taken out, and at 104 the selection and the odds row below it were
  // squeezed into each other by flex rather than overflowing visibly.
  const size = 88;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Satori (next/og); data URI, no network
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: size / 2, objectFit: "cover", background: RAISED }}
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div
      style={{
        display: "flex",
        width: size,
        height: size,
        borderRadius: size / 2,
        background: RAISED,
        border: `1px solid ${BORDER}`,
        alignItems: "center",
        justifyContent: "center",
        fontSize: 32,
        fontWeight: 800,
        color: MUTED,
      }}
    >
      {initials}
    </div>
  );
}

function Crest({ src }: { src?: string | null }): ReactElement | null {
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Satori (next/og); data URI, no network
    <img src={src} alt="" width={44} height={44} style={{ width: 44, height: 44, objectFit: "contain" }} />
  );
}


/**
 * A named value, as the site card now prints them.
 *
 * Label above value rather than beside it. Beside it is what the site does,
 * but the site card is a narrow column and this is 1200x630 — in a two-column
 * body a side label would leave the values on a ragged edge halfway across.
 */
function ShareDetail({ label, children }: { label: string; children: ReactElement | string }): ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", marginBottom: 16 }}>
      <span style={{ display: "flex", fontSize: 18, fontWeight: 700, letterSpacing: 1, color: MUTED }}>
        {label.toUpperCase()}
      </span>
      <span style={{ display: "flex", fontSize: 30, fontWeight: 700, color: FG, marginTop: 2 }}>{children}</span>
    </div>
  );
}

/**
 * The pick, drawn the way the site draws it.
 *
 * This used to be a headline and two stat tiles — accurate, and nothing like
 * the card people actually see. It now follows the on-site order: league and
 * kickoff, the fixture with both crests, the player with their photo and club,
 * then the selection with its price and stake.
 *
 * Still 1200×630. That is not laziness about the card's real proportions: it is
 * the aspect ratio every social preview expects, and a portrait image posted to
 * X or Telegram gets letterboxed or cropped. The layout is the card's; the
 * frame is the one the destination requires.
 */
export function pickCard(d: PickCardData): ReactElement {
  if (d.locked) return lockedPickCard(d);
  const r = RESULT_STYLE[d.result];
  const hasPlayer = Boolean(d.playerName);

  return (
    <CardFrame>
      {/* Cover strip with logo + result badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 104,
          padding: "0 44px",
          background: COVER,
          borderTopLeftRadius: 27,
          borderTopRightRadius: 27,
        }}
      >
        <Wordmark />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: r.bg,
            border: `1px solid ${r.border}`,
            borderRadius: 999,
            padding: "8px 22px",
            fontSize: 24,
            fontWeight: 800,
            color: r.color,
            letterSpacing: 1,
          }}
        >
          {r.label}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "26px 56px 30px 56px" }}>
        {/* League on the left, kickoff on the right — the card's top line */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ display: "flex", fontSize: 22, fontWeight: 700, color: ACCENT }}>
            {d.league || d.sportLabel}
          </span>
          {d.kickoff && <span style={{ display: "flex", fontSize: 22, color: MUTED }}>{d.kickoff}</span>}
        </div>

        {/* The fixture, centred between its crests, as on the site */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 12 }}>
          <Crest src={d.awayLogoDataUri} />
          <span
            style={{
              display: "flex",
              fontSize: 34,
              fontWeight: 700,
              color: FG,
              marginLeft: d.awayLogoDataUri ? 14 : 0,
              marginRight: d.homeLogoDataUri ? 14 : 0,
            }}
          >
            {d.matchup}
          </span>
          <Crest src={d.homeLogoDataUri} />
        </div>

        {/*
          Two columns, because this frame is twice as wide as it is tall. The
          site stacks its labelled rows down a narrow card; four of them
          stacked here would not fit beside the player, and spreading them
          across the width is what the shape of a 1200x630 image is for.
        */}
        <div style={{ display: "flex", flex: 1, marginTop: 22 }}>
          {hasPlayer && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 300 }}>
              <PlayerAvatar src={d.playerPhotoDataUri} name={d.playerName ?? ""} />
              <span style={{ display: "flex", fontSize: 30, fontWeight: 700, color: FG, marginTop: 12 }}>
                {d.playerName}
              </span>
              {d.playerTeam && (
                <span style={{ display: "flex", fontSize: 20, color: MUTED, marginTop: 2 }}>{d.playerTeam}</span>
              )}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: hasPlayer ? 40 : 0 }}>
            {d.betTypeLabel && <ShareDetail label="Bet Type">{d.betTypeLabel}</ShareDetail>}
            <ShareDetail label="Selection">{d.selection}</ShareDetail>
            <div style={{ display: "flex" }}>
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <ShareDetail label="Odds">{americanOdds(d.odds)}</ShareDetail>
              </div>
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <ShareDetail label="Units">{`${d.units}u risk`}</ShareDetail>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", marginTop: "auto", paddingTop: 10, fontSize: 20, color: MUTED }}>
          <span>{`${d.displayName} · @${d.handle} · tracked & graded on Blitz.tips`}</span>
        </div>
      </div>
    </CardFrame>
  );
}
