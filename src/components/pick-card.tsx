import { Lock } from "lucide-react";
import { format } from "date-fns";
import type { Pick as PickModel } from "@prisma/client";
import { ResultPill } from "@/components/result-pill";
import { SportIcon } from "@/components/sport-icon";
import { formatOdds } from "@/lib/odds";
import { SPORT_LABELS, BET_TYPE_LABELS } from "@/lib/utils";

export function PickCard({ pick, locked = false }: { pick: PickModel; locked?: boolean }) {
  if (locked) {
    return (
      <div className="card relative overflow-hidden p-5">
        <div className="flex items-center justify-between text-sm text-muted">
          <span className="flex items-center gap-1.5">
            <SportIcon sport={pick.sport} className="h-4 w-4" />
            {SPORT_LABELS[pick.sport]}
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
          <SportIcon sport={pick.sport} className="h-4 w-4" />
          {SPORT_LABELS[pick.sport]}
          {pick.league ? ` · ${pick.league}` : ""}
        </span>
        <span>{format(pick.eventStartsAt, "MMM d, h:mm a")}</span>
      </div>

      <p className="mt-3 font-semibold">{pick.matchup}</p>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-full bg-surface-raised px-2.5 py-1">{BET_TYPE_LABELS[pick.betType]}</span>
        <span className="font-semibold">{pick.selection}</span>
        <span className="font-semibold tabular-nums">{formatOdds(pick.odds)}</span>
        <span className="text-muted">{pick.units}u</span>
      </div>

      {pick.analysis && <p className="mt-3 text-sm text-muted">{pick.analysis}</p>}

      <div className="mt-4 flex items-center justify-between">
        <ResultPill result={pick.result} />
        {pick.isPremium && <span className="text-xs text-muted">Premium pick</span>}
      </div>
    </div>
  );
}
