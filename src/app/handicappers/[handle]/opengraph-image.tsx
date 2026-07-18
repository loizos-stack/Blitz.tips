import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { computeStats } from "@/lib/odds";
import { computeStreaks, lastNStats } from "@/lib/analytics";
import { SPORT_LABELS } from "@/lib/utils";
import { recordCard, SHARE_CARD_SIZE } from "@/lib/share-cards";

// A handicapper's verified-record card, doubling as the profile's social-share
// image — so every time a capper posts their profile link, the preview *is*
// their verified record. Also downloadable/previewed from the dashboard Share
// tab (fetched at /handicappers/<handle>/opengraph-image).
export const alt = "Verified record on Blitz.tips";
export const size = SHARE_CARD_SIZE;
export const contentType = "image/png";

// Cache the generated card (ISR) rather than regenerating on every request:
// social crawlers (Twitterbot, etc.) have short fetch timeouts, so a fast,
// pre-cached image is far more reliable than a per-request dynamic render.
// Records only move as picks settle, so an hour is plenty fresh.
export const revalidate = 3600;

const fallback = {
  displayName: "Blitz.tips",
  handle: "blitz",
  record: "—",
  unitsNet: 0,
  roi: null,
  winRate: null,
  streak: 0,
  l10: "—",
  totalPicks: 0,
  sports: [] as string[],
};

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;

  // Lightweight query: only the fields the card needs (no parlay legs, reviews,
  // or analysis text), so the image renders quickly for crawlers.
  const profile = await prisma.handicapperProfile
    .findUnique({
      where: { handle },
      select: {
        displayName: true,
        handle: true,
        sports: true,
        suspendedAt: true,
        picks: {
          select: { odds: true, units: true, result: true, eventStartsAt: true, settledAt: true },
        },
      },
    })
    .catch(() => null);

  const data =
    !profile || profile.suspendedAt
      ? fallback
      : (() => {
          const stats = computeStats(profile.picks);
          return {
            displayName: profile.displayName,
            handle: profile.handle,
            record: stats.record,
            unitsNet: stats.unitsNet,
            roi: stats.roi,
            winRate: stats.winRate,
            streak: computeStreaks(profile.picks).current,
            l10: lastNStats(profile.picks, 10).record,
            totalPicks: stats.totalPicks,
            sports: profile.sports.map((s) => SPORT_LABELS[s] ?? s),
          };
        })();

  return new ImageResponse(recordCard(data), size);
}
