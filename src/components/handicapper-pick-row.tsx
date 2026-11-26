"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LocalTime } from "@/components/local-time";
import { Lock, Clock } from "lucide-react";
import type { Pick as PickModel, PickResult } from "@prisma/client";
import { ResultPill } from "@/components/result-pill";
import { TeamLogo } from "@/components/team-logo";
import { PlayerTag } from "@/components/player-tag";
import { PickShareButton } from "@/components/pick-share-button";
import { isPickLocked, isGradableByHandicapper } from "@/lib/pick-visibility";
import { pickShareInfo } from "@/lib/pick-share";
import { Odds } from "@/components/odds-format";
import { SPORT_LABELS, BET_TYPE_LABELS, usesVsSeparator, cn } from "@/lib/utils";
import { UnitsRisk } from "@/components/units-risk";

const SETTLE_OPTIONS: PickResult[] = ["WIN", "LOSS", "PUSH", "VOID"];

// Crests are attached server-side (enrichPickCrests) before the pick reaches
// this client row; a parlay's placeholder matchup resolves to neither side.
type RowPick = PickModel & { awayTeamLogo?: string | null; homeTeamLogo?: string | null };

export function HandicapperPickRow({
  pick,
  share,
}: {
  pick: RowPick;
  share?: { baseUrl: string; handle: string; displayName: string };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function settle(result: PickResult) {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/picks/${pick.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result }),
    });
    setLoading(false);
    // A refusal used to be discarded, so a rejected grade looked exactly like
    // an accepted one until the page came back unchanged.
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Couldn't grade this tip. Please try again.");
      return;
    }
    router.refresh();
  }

  // Mirrors the server's rule. Evaluated at render, so a row left open across
  // kickoff keeps hiding the buttons until the page refreshes — the endpoint is
  // what actually decides, and it re-checks on every attempt.
  const gradable = isGradableByHandicapper(pick);

  // Order crests to match the matchup text: "Home vs Away" sports show the home
  // crest first; "Away @ Home" sports show the away crest first.
  const homeFirst = usesVsSeparator(pick.sport);
  const startLogo = homeFirst ? pick.homeTeamLogo : pick.awayTeamLogo;
  const endLogo = homeFirst ? pick.awayTeamLogo : pick.homeTeamLogo;

  // Share info reflects the public card: a still-locked premium pick shares as a
  // teaser that reveals nothing (isPickLocked from an anonymous viewpoint).
  const shareInfo = share
    ? pickShareInfo({ ...share, pick, locked: isPickLocked(pick, false) })
    : null;

  // A prop is about a person; everything else is about a fixture. Giving the
  // two the same flat row of chips was what made the photo look like a stray
  // favicon next to the bet type.
  const isPlayerPick = Boolean(pick.playerName);

  return (
    <div className={cn("card p-5", pick.isPremium && "card-premium")}>
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          {SPORT_LABELS[pick.sport]}
          {pick.league ? ` · ${pick.league}` : ""}
        </span>
        <LocalTime iso={new Date(pick.eventStartsAt).toISOString()} withZone />
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

      {isPlayerPick ? (
        <>
          <div className="mt-3 flex items-center gap-3">
            <PlayerTag
              size="lg"
              playerName={pick.playerName}
              photoUrl={pick.playerPhotoUrl}
              team={pick.playerTeam}
            />
            <span className="ml-auto shrink-0 self-start rounded-full bg-surface-raised px-2.5 py-1 text-xs">
              {BET_TYPE_LABELS[pick.betType]}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-display font-semibold">{pick.selection}</span>
            <span className="font-semibold tabular-nums"><Odds value={pick.odds} /></span>
            <UnitsRisk units={pick.units} />
            {pick.isPremium && <span className="text-xs text-muted">Premium</span>}
          </div>
        </>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full bg-surface-raised px-2.5 py-1">{BET_TYPE_LABELS[pick.betType]}</span>
          {pick.betType !== "PARLAY" && <span className="font-display font-semibold">{pick.selection}</span>}
          <span className="font-semibold tabular-nums"><Odds value={pick.odds} /></span>
          <UnitsRisk units={pick.units} />
          {pick.isPremium && <span className="text-xs text-muted">Premium</span>}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <ResultPill result={pick.result} />
        {pick.result === "PENDING" && !gradable ? (
          // Nothing to grade yet. Saying so beats offering buttons that the
          // server will refuse.
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
            <Clock className="h-3.5 w-3.5" /> Gradable after kickoff
          </span>
        ) : pick.result === "PENDING" ? (
          <div className="flex flex-wrap gap-2">
            {SETTLE_OPTIONS.map((option) => (
              <button
                key={option}
                disabled={loading}
                onClick={() => settle(option)}
                className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted hover:text-foreground disabled:opacity-50"
              >
                {option}
              </button>
            ))}
          </div>
        ) : (
          // A grade is final — no re-grading once settled. Corrections go through
          // an admin, keeping records tamper-proof.
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
            <Lock className="h-3.5 w-3.5" /> Graded — final
          </span>
        )}
      </div>

      {error && <p className="mt-3 text-xs text-danger">{error}</p>}

      {shareInfo && (
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs text-muted">Share this pick</span>
          <PickShareButton
            text={shareInfo.text}
            url={shareInfo.url}
            imageUrl={shareInfo.imageUrl}
            downloadName={shareInfo.downloadName}
          />
        </div>
      )}
    </div>
  );
}
