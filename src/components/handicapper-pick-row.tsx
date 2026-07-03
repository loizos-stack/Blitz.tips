"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import type { Pick as PickModel, PickResult } from "@prisma/client";
import { ResultPill } from "@/components/result-pill";
import { formatOdds } from "@/lib/odds";
import { SPORT_LABELS, BET_TYPE_LABELS, cn } from "@/lib/utils";

const SETTLE_OPTIONS: PickResult[] = ["WIN", "LOSS", "PUSH", "VOID"];

export function HandicapperPickRow({ pick }: { pick: PickModel }) {
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

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
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
