import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { SPORT_LABELS } from "@/lib/utils";
import { pickCard, SHARE_CARD_SIZE } from "@/lib/share-cards";

export const dynamic = "force-dynamic";

// Branded PNG for a single settled pick, used by the dashboard Share tab
// (preview + download) and safe to share publicly. Only *settled* picks render
// — a pending premium pick is still paywalled, so we never expose its selection
// here.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pick = await prisma.pick.findUnique({
    where: { id },
    include: { handicapper: { select: { displayName: true, handle: true, suspendedAt: true } } },
  });

  if (!pick || !pick.handicapper || pick.handicapper.suspendedAt || pick.result === "PENDING") {
    return new Response("Not found", { status: 404 });
  }

  return new ImageResponse(
    pickCard({
      displayName: pick.handicapper.displayName,
      handle: pick.handicapper.handle,
      sportLabel: SPORT_LABELS[pick.sport] ?? pick.sport,
      matchup: pick.matchup,
      selection: pick.selection,
      odds: pick.odds,
      units: pick.units,
      result: pick.result,
    }),
    SHARE_CARD_SIZE
  );
}
