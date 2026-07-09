import { Lock, Layers } from "lucide-react";
import { format } from "date-fns";
import type { Pick as PickModel, ParlayLeg } from "@prisma/client";
import { ResultPill } from "@/components/result-pill";
import { SportIcon } from "@/components/sport-icon";
import { formatOdds } from "@/lib/odds";
import { SPORT_LABELS, BET_TYPE_LABELS } from "@/lib/utils";

type PickWithLegs = PickModel & { parlayLegs?: Pick<ParlayLeg, "id" | "matchup" | "selection" | "odds">[] };

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
          <p className="font-semibold">{pick.matchup}</p>
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
            {legs.map((leg) => (
              <li key={leg.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{leg.selection}</span>
                  <span className="block truncate text-xs text-muted">{leg.matchup}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted">{formatOdds(leg.odds)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <UnitsBadge units={pick.units} />
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 font-semibold">{pick.matchup}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full bg-surface-raised px-2.5 py-1">{BET_TYPE_LABELS[pick.betType]}</span>
            <span className="font-semibold">{pick.selection}</span>
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
