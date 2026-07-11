import { Lock, Layers } from "lucide-react";
import { format } from "date-fns";
import type { Pick as PickModel, ParlayLeg } from "@prisma/client";
import { ResultPill } from "@/components/result-pill";
import { SportIcon } from "@/components/sport-icon";
import { TeamLogo } from "@/components/team-logo";
import { getTeamLogoUrl } from "@/lib/team-logos";
import { formatOdds } from "@/lib/odds";
import { SPORT_LABELS, BET_TYPE_LABELS } from "@/lib/utils";
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
  return (
    <span className="flex shrink-0 items-center -space-x-1.5">
      {awayLogo && <TeamLogo sport={sport} logoUrl={awayLogo} className={`${size} rounded-full ring-2 ring-surface`} />}
      {homeLogo && <TeamLogo sport={sport} logoUrl={homeLogo} className={`${size} rounded-full ring-2 ring-surface`} />}
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

export function PickCard({ pick, locked = false }: { pick: PickWithLegs; locked?: boolean }) {
  const isParlay = pick.betType === "PARLAY";
  const legs = pick.parlayLegs ?? [];
  // Prefer server-enriched crests (covers TheSportsDB); fall back to the
  // synchronous ESPN lookup so an un-enriched pick still shows US-league logos.
  const sync = isParlay ? null : matchupCrests(pick.sport, pick.matchup);
  const awayLogo = pick.awayTeamLogo ?? sync?.awayLogo ?? null;
  const homeLogo = pick.homeTeamLogo ?? sync?.homeLogo ?? null;

  if (locked) {
    return (
      <div className="card relative overflow-hidden p-5">
        <div className="flex items-center justify-between text-sm text-muted">
          <span className="flex items-center gap-1.5">
            {isParlay ? <Layers className="h-4 w-4" /> : <SportIcon sport={pick.sport} className="h-4 w-4" />}
            {isParlay ? `${legs.length}-leg parlay` : SPORT_LABELS[pick.sport]}
          </span>
          <span>{format(pick.eventStartsAt, "MMM d, h:mm a")}</span>
        </div>
        <div className="mt-3 flex items-center gap-2 blur-sm select-none">
          <p className="font-display font-semibold">{pick.matchup}</p>
        </div>
        <div className="mt-3 flex items-center gap-2 blur-sm select-none">
          <span className="text-sm">{BET_TYPE_LABELS[pick.betType]}</span>
          <span className="text-sm font-semibold">{formatOdds(pick.odds)}</span>
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
        <span>{format(pick.eventStartsAt, "MMM d, h:mm a")}</span>
      </div>

      {isParlay ? (
        <>
          <div className="mt-3 flex items-center justify-between">
            <p className="font-semibold">{legs.length}-leg parlay</p>
            <span className="rounded-full bg-accent/10 px-2.5 py-1 text-sm font-semibold tabular-nums text-accent">
              {formatOdds(pick.odds)}
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
                  <span className="shrink-0 tabular-nums text-muted">{formatOdds(leg.odds)}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-3">
            <UnitsBadge units={pick.units} />
          </div>
        </>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-2">
            {awayLogo && (
              <TeamLogo sport={pick.sport} logoUrl={awayLogo} className="h-6 w-6 shrink-0 rounded-full ring-2 ring-surface" />
            )}
            <p className="font-display font-semibold">{pick.matchup}</p>
            {homeLogo && (
              <TeamLogo sport={pick.sport} logoUrl={homeLogo} className="h-6 w-6 shrink-0 rounded-full ring-2 ring-surface" />
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full bg-surface-raised px-2.5 py-1">{BET_TYPE_LABELS[pick.betType]}</span>
            <span className="font-display font-semibold">{pick.selection}</span>
            <span className="font-semibold tabular-nums">{formatOdds(pick.odds)}</span>
            <UnitsBadge units={pick.units} />
          </div>
        </>
      )}

      {pick.analysis && <p className="mt-3 text-sm text-muted">{pick.analysis}</p>}

      <div className="mt-4 flex items-center justify-between">
        <ResultPill result={pick.result} />
        {pick.isPremium && <span className="text-xs text-muted">Premium pick</span>}
      </div>
    </div>
  );
}
