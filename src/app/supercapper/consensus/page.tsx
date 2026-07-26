import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Users, Split } from "lucide-react";
import {
  contestConsensus,
  MIN_PICKS_FOR_CONSENSUS,
  MIN_QUALIFIED_FOR_SPLIT,
  type ConsensusGame,
} from "@/lib/contest-consensus";
import { formatOdds } from "@/lib/odds";
import { SPORT_LABELS } from "@/lib/utils";
import { SportIcon } from "@/components/sport-icon";
import { LocalTime } from "@/components/local-time";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Supercapper Contest — Consensus",
  description:
    "Where the Supercapper Contest field is betting: pick and unit splits on every upcoming game, plus what the qualified entrants are on.",
  alternates: { canonical: "/supercapper/consensus" },
};

export default async function SupercapperConsensusPage() {
  const data = await contestConsensus();
  if (!data) redirect("/supercapper");

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[url('/hero-bg.svg')] bg-cover bg-center opacity-[0.06]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-accent/10 via-transparent to-transparent" />

      <div className="container-page relative py-10">
        <Link
          href="/supercapper"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Contest overview
        </Link>

        <div className="mt-4">
          <h1 className="text-3xl font-bold">Contest consensus</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Where the field is betting on games that haven&apos;t started. Every pick counted here was posted by an
            entrant building a public, auto-graded record — not an anonymous ticket. Games with fewer than{" "}
            {MIN_PICKS_FOR_CONSENSUS} picks are hidden until the sample means something.
          </p>
        </div>

        {data.games.length === 0 ? (
          <div className="card mt-8 p-8 text-center text-muted">
            No consensus yet — once entrants have posted on upcoming games, the splits show up here.
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" /> {data.entrants} entrants
              </span>
              <span className="inline-flex items-center gap-1.5">
                {data.games.length} game{data.games.length === 1 ? "" : "s"} with a live split
              </span>
            </div>

            <div className="mt-6 flex flex-col gap-4">
              {data.games.map((game) => (
                <GameConsensus key={game.eventId} game={game} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function GameConsensus({ game }: { game: ConsensusGame }) {
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SportIcon sport={game.sport} className="h-4 w-4" />
          <span className="font-display font-semibold">{game.matchup}</span>
          <span className="text-xs text-muted">{SPORT_LABELS[game.sport]}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          {game.split && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 font-semibold text-gold"
              title="The qualified entrants' most-backed side is not the field's"
            >
              <Split className="h-3 w-3" /> Qualified fading the field
            </span>
          )}
          <LocalTime iso={game.startsAt.toISOString()} />
        </div>
      </div>

      <p className="mt-1 text-xs text-muted">
        {game.totalPicks} picks · {game.totalUnits}u staked
        {game.qualifiedTotal >= MIN_QUALIFIED_FOR_SPLIT &&
          ` · ${game.qualifiedTotal} from qualified entrants`}
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {game.sides.map((side) => (
          <div key={side.selection}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium">
                {side.selection} <span className="text-muted">{formatOdds(side.odds)}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                <span className="font-semibold">{side.pickShare}%</span>
                <span className="ml-2 text-xs text-muted">
                  {side.picks} pick{side.picks === 1 ? "" : "s"} · {side.units}u
                </span>
              </span>
            </div>

            {/* Two bars: the whole field, and the qualified subset beneath it.
                Seeing them diverge is the point of the page. */}
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-raised">
              <div className="h-full rounded-full bg-accent" style={{ width: `${side.pickShare}%` }} />
            </div>
            {side.qualifiedShare != null && (
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-raised">
                  <div className="h-full rounded-full bg-gold" style={{ width: `${side.qualifiedShare}%` }} />
                </div>
                <span className="shrink-0 text-[10px] tabular-nums text-muted">
                  {side.qualifiedShare}% qualified
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
