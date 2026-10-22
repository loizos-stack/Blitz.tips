import { Lock, Layers } from "lucide-react";
import { TailButtons } from "@/components/tail-buttons";
import { formatDateTime } from "@/lib/date-format";
import type { Pick as PickModel, ParlayLeg } from "@prisma/client";
import { ResultPill } from "@/components/result-pill";
import { SportsbookCta } from "@/components/sportsbook-cta";
import type { Sportsbook } from "@/lib/sportsbooks";
import { SportIcon } from "@/components/sport-icon";
import { TeamLogo } from "@/components/team-logo";
import { getTeamLogoUrl } from "@/lib/team-logos";
import { Odds } from "@/components/odds-format";
import { SPORT_LABELS, BET_TYPE_LABELS, usesVsSeparator } from "@/lib/utils";
import type { PickSport } from "@prisma/client";

// Synchronous ESPN fallback for the away/home crests from a matchup string —
// used when the pick hasn't been enriched server-side (enrichPickCrests adds
// awayTeamLogo/homeTeamLogo, incl. TheSportsDB coverage). Splits on the usual
// separators so both "Away @ Home" and "Home vs Away" resolve.
function matchupCrests(sport: PickSport, matchup: string) {
  const [away, home] = matchup.split(/\s+(?:@|vs\.?|at)\s+/i);
  return {
    awayLogo: getTeamLogoUrl(sport, (away ?? "").trim()),
    homeLogo: getTeamLogoUrl(sport, (home ?? "").trim()),
  };
}

// Optional pre-resolved crests attached by enrichPickCrests (server-side). When
// absent, PickCard falls back to the synchronous ESPN lookup above.
type CrestFields = { awayTeamLogo?: string | null; homeTeamLogo?: string | null };
type LegWithCrests = Pick<ParlayLeg, "id" | "matchup" | "selection" | "odds"> & CrestFields;
type PickWithLegs = PickModel & CrestFields & { parlayLegs?: LegWithCrests[] };

// Overlapping away+home crests, shown before a matchup (parlay legs). Renders
// nothing when neither side resolves.
function CrestPair({
  sport,
  awayLogo,
  homeLogo,
  size = "h-6 w-6",
}: {
  sport: PickSport;
  awayLogo: string | null;
  homeLogo: string | null;
  size?: string;
}) {
  if (!awayLogo && !homeLogo) return null;
  // Match the matchup text order: home crest first for "Home vs Away" sports.
  const [first, second] = usesVsSeparator(sport) ? [homeLogo, awayLogo] : [awayLogo, homeLogo];
  return (
    <span className="flex shrink-0 items-center -space-x-1.5">
      {first && <TeamLogo sport={sport} logoUrl={first} className={`${size} rounded-full ring-2 ring-surface`} />}
      {second && <TeamLogo sport={sport} logoUrl={second} className={`${size} rounded-full ring-2 ring-surface`} />}
    </span>
  );
}

// The stake on a bet, emphasized so followers can size their own play.
function UnitsBadge({ units }: { units: number }) {
  return (
    <span className="inline-flex items-baseline gap-1 rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1">
      <span className="text-base font-bold tabular-nums text-accent">{units}u</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-accent/80">risk</span>
    </span>
  );
}

export function PickCard({
  pick,
  locked = false,
  book = null,
  tail,
}: {
  pick: PickWithLegs;
  locked?: boolean;
  /** Renders the Stake partner link. Caller must have geo-gated to non-US. */
  book?: Sportsbook | null;
  /**
   * Tail/fade counts and the reader's own position. Omitted where the control
   * doesn't belong — a signed-out visitor, or the capper's own dashboard.
   */
  tail?: { tails: number; fades: number; mine: boolean | null; canTail: boolean; reason?: string };
}) {
  const isParlay = pick.betType === "PARLAY";
  const legs = pick.parlayLegs ?? [];
  // Prefer server-enriched crests (covers TheSportsDB); fall back to the
  // synchronous ESPN lookup so an un-enriched pick still shows US-league logos.
  const sync = isParlay ? null : matchupCrests(pick.sport, pick.matchup);
  const awayLogo = pick.awayTeamLogo ?? sync?.awayLogo ?? null;
  const homeLogo = pick.homeTeamLogo ?? sync?.homeLogo ?? null;
  // Order crests to match the matchup text: home crest leads for "Home vs Away"
  // sports (soccer, etc.), away crest leads for "Away @ Home" (US) sports.
  const [startLogo, endLogo] = usesVsSeparator(pick.sport)
    ? [homeLogo, awayLogo]
    : [awayLogo, homeLogo];

  /**
   * The affiliate link sits beside the stake, in the same row as the price and
   * the units — that row is the bet, and the link belongs with it rather than
   * floating underneath.
   *
   * Shown until the pick is graded, not until kickoff. A pick can be live and
   * still worth backing in-play, and a card that silently drops its link the
   * moment a game starts looks broken rather than deliberate. Once there's a
   * result there is nothing left to place, so PENDING is the whole condition.
   */
  const betCta =
    book && pick.result === "PENDING" ? (
      <SportsbookCta
        book={book}
        variant="button"
        sport={pick.sport}
        league={pick.oddsApiSportKey}
        event={pick.oddsApiEventId}
      />
    ) : null;

  if (locked) {
    return (
      <div className="card relative overflow-hidden p-5">
        <div className="flex items-center justify-between text-sm text-muted">
          <span className="flex items-center gap-1.5">
            {isParlay ? <Layers className="h-4 w-4" /> : <SportIcon sport={pick.sport} className="h-4 w-4" />}
            {isParlay ? `${legs.length}-leg parlay` : SPORT_LABELS[pick.sport]}
          </span>
          <span>{formatDateTime(pick.eventStartsAt)}</span>
        </div>
        <div className="mt-3 flex items-center gap-2 blur-sm select-none">
          <p className="font-display font-semibold">{pick.matchup}</p>
        </div>
        <div className="mt-3 flex items-center gap-2 blur-sm select-none">
          <span className="text-sm">{BET_TYPE_LABELS[pick.betType]}</span>
          <span className="text-sm font-semibold"><Odds value={pick.odds} /></span>
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-surface/70 backdrop-blur-[2px]">
          <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium">
            <Lock className="h-4 w-4" /> Subscribe to unlock
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between text-sm text-muted">
        <span className="flex items-center gap-1.5">
          {isParlay ? <Layers className="h-4 w-4" /> : <SportIcon sport={pick.sport} className="h-4 w-4" />}
          {isParlay ? "Parlay" : SPORT_LABELS[pick.sport]}
          {!isParlay && pick.league ? ` · ${pick.league}` : ""}
        </span>
        <span>{formatDateTime(pick.eventStartsAt)}</span>
      </div>

      {isParlay ? (
        <>
          <div className="mt-3 flex items-center justify-between">
            <p className="font-semibold">{legs.length}-leg parlay</p>
            <span className="rounded-full bg-accent/10 px-2.5 py-1 text-sm font-semibold tabular-nums text-accent">
              <Odds value={pick.odds} />
            </span>
          </div>
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
            {legs.map((leg) => {
              const legSync = matchupCrests(pick.sport, leg.matchup);
              return (
                <li key={leg.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <CrestPair
                      sport={pick.sport}
                      awayLogo={leg.awayTeamLogo ?? legSync.awayLogo ?? null}
                      homeLogo={leg.homeTeamLogo ?? legSync.homeLogo ?? null}
                      size="h-5 w-5"
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-display font-medium">{leg.selection}</span>
                      <span className="block truncate font-display text-xs text-muted">{leg.matchup}</span>
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted"><Odds value={leg.odds} /></span>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <UnitsBadge units={pick.units} />
            {betCta}
          </div>
        </>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-2">
            {startLogo && (
              <TeamLogo sport={pick.sport} logoUrl={startLogo} className="h-6 w-6 shrink-0 rounded-full ring-2 ring-surface" />
            )}
            <p className="font-display font-semibold">{pick.matchup}</p>
            {endLogo && (
              <TeamLogo sport={pick.sport} logoUrl={endLogo} className="h-6 w-6 shrink-0 rounded-full ring-2 ring-surface" />
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full bg-surface-raised px-2.5 py-1">{BET_TYPE_LABELS[pick.betType]}</span>
            <span className="font-display font-semibold">{pick.selection}</span>
            <span className="font-semibold tabular-nums"><Odds value={pick.odds} /></span>
            <UnitsBadge units={pick.units} />
            {betCta}
          </div>
        </>
      )}

      {pick.analysis && <p className="mt-3 text-sm text-muted">{pick.analysis}</p>}

      {/* Under the analysis, above the result: it belongs with the decision,
          not with the outcome. */}
      {tail && (
        <div className="mt-3 border-t border-border pt-3">
          <TailButtons
            pickId={pick.id}
            tails={tail.tails}
            fades={tail.fades}
            mine={tail.mine}
            disabled={!tail.canTail}
            disabledReason={tail.reason}
          />
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <ResultPill result={pick.result} />
        {pick.isPremium ? (
          <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold">
            Premium
          </span>
        ) : (
          <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
            Free
          </span>
        )}
      </div>
    </div>
  );
}
