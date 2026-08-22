import { prisma } from "@/lib/prisma";
import { guardAdminPage } from "@/lib/permissions";
import { oddsApiKey } from "@/lib/odds-api";
import { telegramConfigured } from "@/lib/telegram";
import { getWatchSettings, estimateRunCost, creditsUsedToday } from "@/lib/blitz-odds-poll";
import { alertChatId } from "@/lib/blitz-odds-notify";
import { unverifiedMarketKeys } from "@/lib/blitz-odds-markets";
import { BlitzOddsManager } from "@/components/admin/blitz-odds-manager";

export const dynamic = "force-dynamic";

export default async function BlitzOddsPage() {
  await guardAdminPage("odds");

  const settings = await getWatchSettings();
  const [estimate, usedToday, drops, runs] = await Promise.all([
    estimateRunCost(settings),
    creditsUsedToday(),
    prisma.oddsDrop.findMany({ orderBy: { detectedAt: "desc" }, take: 60 }),
    prisma.oddsPollRun.findMany({ orderBy: { startedAt: "desc" }, take: 12 }),
  ]);

  return (
    <BlitzOddsManager
      configured={Boolean(oddsApiKey())}
      telegramReady={telegramConfigured() && Boolean(alertChatId(settings))}
      unverifiedMarkets={unverifiedMarketKeys()}
      settings={{
        enabled: settings.enabled,
        pollMinutes: settings.pollMinutes,
        baselineFromMinutes: settings.baselineFromMinutes,
        baselineToMinutes: settings.baselineToMinutes,
        alertFromMinutes: settings.alertFromMinutes,
        alertToMinutes: settings.alertToMinutes,
        bookmakers: settings.bookmakers,
        minProbDelta: settings.minProbDelta,
        minBooks: settings.minBooks,
        watchGameLines: settings.watchGameLines,
        watchAlternates: settings.watchAlternates,
        watchProps: settings.watchProps,
        watchSoccerExtras: settings.watchSoccerExtras,
        dailyCreditCap: settings.dailyCreditCap,
        maxDeepEvents: settings.maxDeepEvents,
        sportKeys: settings.sportKeys,
        notifyOnSite: settings.notifyOnSite,
        notifyPush: settings.notifyPush,
        notifyTelegram: settings.notifyTelegram,
        telegramChatId: settings.telegramChatId,
      }}
      estimate={estimate}
      usedToday={usedToday}
      drops={drops.map((d) => ({
        id: d.id,
        matchup: d.matchup,
        sport: d.sport,
        marketLabel: d.marketLabel,
        selection: d.selection,
        point: d.point,
        bookCount: d.bookCount,
        books: d.books,
        openPrice: d.openPrice,
        currentPrice: d.currentPrice,
        probDelta: d.probDelta,
        baselineMinutes: d.baselineMinutes,
        minutesToStart: d.minutesToStart,
        notifiedAt: d.notifiedAt?.toISOString() ?? null,
        detectedAt: d.detectedAt.toISOString(),
      }))}
      runs={runs.map((r) => ({
        id: r.id,
        startedAt: r.startedAt.toISOString(),
        credits: r.credits,
        requests: r.requests,
        eventsSeen: r.eventsSeen,
        dropsFound: r.dropsFound,
        booksSeen: r.booksSeen,
        stoppedReason: r.stoppedReason,
        error: r.error,
      }))}
    />
  );
}
