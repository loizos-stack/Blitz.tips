"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import type { Pick as PickModel, PickResult } from "@prisma/client";
import { ResultPill } from "@/components/result-pill";
import { TeamLogo } from "@/components/team-logo";
import { formatOdds } from "@/lib/odds";
import { SPORT_LABELS, BET_TYPE_LABELS, cn, usesVsSeparator } from "@/lib/utils";

const SETTLE_OPTIONS: PickResult[] = ["WIN", "LOSS", "PUSH", "VOID"];

// Crests are attached server-side (enrichPickCrests) before the pick reaches
// this client row; a parlay's placeholder matchup resolves to neither side.
type RowPick = PickModel & { awayTeamLogo?: string | null; homeTeamLogo?: string | null };

export function HandicapperPickRow({ pick }: { pick: RowPick }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function settle(result: PickResult) {
    setLoading(true);
    await fetch(`/api/picks/${pick.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result }),
    });
    setLoading(false);
    router.refresh();
  }

  // Order crests to match the matchup text: "Home vs Away" sports show the home
  // crest first; "Away @ Home" sports show the away crest first.
  const homeFirst = usesVsSeparator(pick.sport);
  const startLogo = homeFirst ? pick.homeTeamLogo : pick.awayTeamLogo;
  const endLogo = homeFirst ? pick.awayTeamLogo : pick.homeTeamLogo;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          {SPORT_LABELS[pick.sport]}
          {pick.league ? ` · ${pick.league}` : ""}
        </span>
        <span>{format(pick.eventStartsAt, "MMM d, h:mm a")}</span>
      </div>

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
        {pick.betType !== "PARLAY" && <span className="font-display font-semibold">{pick.selection}</span>}
        <span className="font-semibold tabular-nums">{formatOdds(pick.odds)}</span>
        <span className="inline-flex items-baseline gap-1 rounded-lg border border-accent/30 bg-accent/10 px-2 py-0.5">
          <span className="font-bold tabular-nums text-accent">{pick.units}u</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-accent/80">risk</span>
        </span>
        {pick.isPremium && <span className="text-xs text-muted">Premium</span>}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <ResultPill result={pick.result} />
        <div className="flex flex-wrap gap-2">
          {SETTLE_OPTIONS.map((option) => (
            <button
              key={option}
              disabled={loading}
              onClick={() => settle(option)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium disabled:opacity-50",
                pick.result === option
                  ? option === "WIN"
                    ? "border-accent bg-accent/10 text-accent"
                    : option === "LOSS"
                      ? "border-danger bg-danger/10 text-danger"
                      : "border-push bg-push/10 text-push"
                  : "border-border text-muted hover:text-foreground"
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
