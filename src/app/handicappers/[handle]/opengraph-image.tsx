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

// Fetch an image (avatar/cover) and inline it as a data URI so Satori never has
// to fetch it itself (a failed Satori fetch throws and breaks the whole card).
// Any failure — bad URL, non-image, oversized, network — degrades to null so the
// card falls back to the monogram/gradient.
async function toDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > 3_000_000) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

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
        avatarUrl: true,
        coverUrl: true,
        picks: {
          select: { odds: true, units: true, result: true, eventStartsAt: true, settledAt: true },
        },
      },
    })
    .catch(() => null);

  if (!profile || profile.suspendedAt) {
    return new ImageResponse(recordCard(fallback), size);
  }

  // Pull the real profile photo + cover in parallel; each degrades to null.
  const [avatarDataUri, coverDataUri] = await Promise.all([
    toDataUri(profile.avatarUrl),
    toDataUri(profile.coverUrl),
  ]);

  const stats = computeStats(profile.picks);
  return new ImageResponse(
    recordCard({
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
      avatarDataUri,
      coverDataUri,
    }),
    size
  );
}
