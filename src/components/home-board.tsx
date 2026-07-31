import { UpcomingGames } from "@/components/upcoming-games";
import { getUpcomingEvents, getAllUpcomingEvents, getAvailableHomepageSports } from "@/lib/odds-api";
import { showStakeLinks } from "@/lib/stake-server";
import { SPORT_LABELS } from "@/lib/utils";
import type { PickSport } from "@prisma/client";

/**
 * The "Today's lines" board, isolated so the page can stream around it.
 *
 * This is by far the slowest thing on the homepage and the only part that
 * depends on a third party. Building it means resolving which sports have games
 * (a request per sport), then a request per league behind each one — soccer
 * alone fans out to MAX_SOCCER_LEAGUES of them — and then a crest lookup per
 * team. Warm, that's all cache hits. Cold, it's hundreds of upstream requests,
 * and while it sat inline in the page every one of them delayed the first byte:
 * a visitor stared at nothing until an odds API on the other side of the world
 * had answered.
 *
 * As its own component under Suspense, the hero, the stats and the handicapper
 * grid render and stream immediately, and the board drops in when it's ready.
 */
export async function HomeBoard({ sportParam }: { sportParam?: string }) {
  const unsortedSports = await getAvailableHomepageSports();

  // Alphabetized by display label so the tab order is predictable.
  const availableSports = [...unsortedSports].sort((a, b) =>
    (SPORT_LABELS[a] ?? a).localeCompare(SPORT_LABELS[b] ?? b)
  );

  // Default view merges every sport's games sorted by start time; picking a
  // sport pill (?sport=...) narrows to just that sport. Each sport's feed is
  // cached and the "all" view reuses those caches, so no extra billed calls.
  const sport: PickSport | null = availableSports.includes(sportParam as PickSport)
    ? (sportParam as PickSport)
    : null;

  const oddsFeed = sport
    ? await getUpcomingEvents(sport, { windowOnly: true })
    : await getAllUpcomingEvents(availableSports);

  return (
    <UpcomingGames
      sport={sport}
      feed={oddsFeed}
      availableSports={availableSports}
      showStake={await showStakeLinks()}
    />
  );
}

/**
 * Placeholder held while the board loads. It reserves the same vertical space
 * the real section takes, so the content below doesn't jump when it arrives.
 */
export function HomeBoardSkeleton() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-surface/60 py-14">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[url('/lines-bg.svg')] bg-cover bg-center"
      />
      <div className="container-page relative">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">Today&apos;s lines</h2>
          <p className="mt-1 text-muted">Live moneyline, spread, and total odds from the board.</p>
        </div>
        <div className="flex gap-4 overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="card h-56 w-80 shrink-0 animate-pulse opacity-60" />
          ))}
        </div>
      </div>
    </section>
  );
}
