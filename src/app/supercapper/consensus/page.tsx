import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Users, Split } from "lucide-react";
import {
  contestConsensus,
  MIN_QUALIFIED_FOR_SPLIT,
  type ConsensusGame,
  type ConsensusMarket,
} from "@/lib/contest-consensus";
import { formatOdds } from "@/lib/odds";
import { SportIcon } from "@/components/sport-icon";
import { LocalTime } from "@/components/local-time";
import { MatchupTeams } from "@/components/matchup-teams";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Supercapper Contest — Consensus",
  description:
    "Every pick the Supercapper Contest field has live, by league and match: pick and unit splits on each market, plus what the qualified entrants are on.",
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
            Every live pick the field has on games that haven&apos;t started, by league and match. Each market is
            counted on its own, so a spread and a player prop on the same game aren&apos;t averaged together. Every
            pick here was posted by an entrant building a public, auto-graded record — not an anonymous ticket.
          </p>
        </div>

        {data.leagues.length === 0 ? (
          <div className="card mt-8 p-8 text-center text-muted">
            No live picks yet — once entrants post on upcoming games, they show up here.
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" /> {data.entrants} entrants
              </span>
              <span>{data.totalPicks} live picks</span>
              <span>
                {data.games} game{data.games === 1 ? "" : "s"} across {data.leagues.length} league
                {data.leagues.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="mt-8 flex flex-col gap-10">
              {data.leagues.map((league) => (
                <section key={league.sport}>
                  <h2 className="flex items-center gap-2 border-b border-border pb-2 text-lg font-bold">
                    <SportIcon sport={league.sport} className="h-5 w-5" />
                    {league.label}
                    <span className="text-xs font-medium text-muted">
                      {league.games.length} game{league.games.length === 1 ? "" : "s"} · {league.totalPicks} picks
                    </span>
                  </h2>

                  <div className="mt-4 flex flex-col gap-5">
                    {league.games.map((game) => (
                      <MatchConsensus key={game.eventId} game={game} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** One match: its header, then a small card per market bet on it. */
function MatchConsensus({ game }: { game: ConsensusGame }) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="flex min-w-0 items-center gap-2 font-display font-semibold">
          <MatchupTeams
            sport={game.sport}
            matchup={game.matchup}
            awayLogo={game.awayLogo}
            homeLogo={game.homeLogo}
            logoClassName="h-5 w-5"
          />
          {game.hasSplit && (
            <span
              className="ml-2 inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 align-middle text-[10px] font-semibold text-gold"
              title="On at least one market, the qualified entrants' most-backed side is not the field's"
            >
              <Split className="h-3 w-3" /> Qualified fading
            </span>
          )}
        </p>
        <p className="text-xs text-muted">
          <LocalTime iso={game.startsAt.toISOString()} /> · {game.totalPicks} pick
          {game.totalPicks === 1 ? "" : "s"} · {game.totalUnits}u
        </p>
      </div>

      <div className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {game.markets.map((market) => (
          <MarketCard key={market.key} market={market} />
        ))}
      </div>
    </div>
  );
}

function MarketCard({ market }: { market: ConsensusMarket }) {
  return (
    <div className="card p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-semibold">{market.label}</p>
        <p className="shrink-0 text-[10px] text-muted">
          {market.totalPicks} · {market.totalUnits}u
        </p>
      </div>
      {market.split && (
        <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-gold">
          <Split className="h-3 w-3" /> Qualified fading the field
        </p>
      )}

      <div className="mt-2.5 flex flex-col gap-2">
        {market.sides.map((side) => (
          <div key={side.selection}>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="min-w-0 truncate">
                {side.selection} <span className="text-muted">{formatOdds(side.odds)}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{side.pickShare}%</span>
            </div>

            {/* Field split on top; the qualified subset beneath it when the
                sample supports one. Seeing them diverge is the point. */}
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-raised">
              <div className="h-full rounded-full bg-accent" style={{ width: `${side.pickShare}%` }} />
            </div>
            {side.qualifiedShare != null && (
              <div className="mt-0.5 flex items-center gap-1.5">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-raised">
                  <div className="h-full rounded-full bg-gold" style={{ width: `${side.qualifiedShare}%` }} />
                </div>
                <span className="shrink-0 text-[9px] tabular-nums text-muted">{side.qualifiedShare}% qual</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {market.qualifiedTotal >= MIN_QUALIFIED_FOR_SPLIT && (
        <p className="mt-2 text-[10px] text-muted">{market.qualifiedTotal} from qualified entrants</p>
      )}
    </div>
  );
}
