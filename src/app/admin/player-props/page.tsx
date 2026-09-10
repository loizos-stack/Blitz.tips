import { prisma } from "@/lib/prisma";
import { guardAdminPage } from "@/lib/permissions";
import { oddsApiKey } from "@/lib/odds-api";
import {
  getPropSettings,
  estimateRunCost,
  creditsUsedToday,
  PROP_SPORTS,
  POLL_MINUTES,
} from "@/lib/player-props-poll";
import { marketLabel } from "@/lib/odds-markets";
import { bookReactions, type Move } from "@/lib/player-props";
import { PlayerPropsManager } from "@/components/admin/player-props-manager";

interface StoredMove {
  marketKey: string;
  selection: string;
  bookmaker: string;
  kind: "price" | "line";
  from: number;
  to: number;
  probDelta: number;
  /** ISO string — when the opening price was first seen. */
  openedAt?: string;
  /** ISO string — when this book was first seen past the threshold. */
  movedAt?: string | null;
}

export const dynamic = "force-dynamic";

export default async function PlayerPropsPage() {
  await guardAdminPage("props");

  const settings = await getPropSettings();
  const [usedToday, signals, runs] = await Promise.all([
    creditsUsedToday(),
    prisma.propSignal.findMany({ orderBy: { detectedAt: "desc" }, take: 60 }),
    prisma.propPollRun.findMany({ orderBy: { startedAt: "desc" }, take: 12 }),
  ]);

  return (
    <PlayerPropsManager
      configured={Boolean(oddsApiKey())}
      sports={PROP_SPORTS}
      pollMinutes={POLL_MINUTES}
      settings={settings}
      estimate={estimateRunCost(settings, POLL_MINUTES)}
      usedToday={usedToday}
      signals={signals.map((s) => {
        const moves = JSON.parse(s.movesJson) as StoredMove[];
        return {
          id: s.id,
          matchup: s.matchup,
          sportKey: s.sportKey,
          player: s.player,
          marketCount: s.marketCount,
          bookCount: s.bookCount,
          books: s.books,
          markets: s.markets,
          direction: s.direction,
          topProbDelta: s.topProbDelta,
          // Labelled here rather than in the browser: marketLabel lives in a
          // server-only module, and shipping raw JSON for the client to unpack
          // buys nothing.
          moves: moves.map((m) => ({ ...m, label: marketLabel(m.marketKey, "PROP") })),
          // Which book moved first and how far behind the rest were. Computed
          // here so the browser is handed the answer rather than the dates.
          reactions: bookReactions(
            moves
              .filter((m) => m.movedAt)
              .map((m) => ({ ...m, movedAt: new Date(m.movedAt!) }) as unknown as Move)
          ).map((r) => ({ bookmaker: r.bookmaker, at: r.at.toISOString(), lagMinutes: r.lagMinutes })),
          // The earliest baseline in the cluster: how far back "since open"
          // actually reaches, which is not the same as when the alert fired.
          openedAt:
            moves
              .map((m) => m.openedAt)
              .filter((x): x is string => Boolean(x))
              .sort()[0] ?? null,
          minutesToStart: s.minutesToStart,
          detectedAt: s.detectedAt.toISOString(),
          acknowledgedAt: s.acknowledgedAt?.toISOString() ?? null,
        };
      })}
      runs={runs.map((r) => ({
        id: r.id,
        startedAt: r.startedAt.toISOString(),
        credits: r.credits,
        requests: r.requests,
        eventsSeen: r.eventsSeen,
        playersSeen: r.playersSeen,
        signalsFound: r.signalsFound,
        stoppedReason: r.stoppedReason,
        error: r.error,
      }))}
    />
  );
}
