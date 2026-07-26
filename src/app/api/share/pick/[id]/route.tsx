import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { SPORT_LABELS } from "@/lib/utils";
import { isPickLocked } from "@/lib/pick-visibility";
import { pickCard, SHARE_CARD_SIZE } from "@/lib/share-cards";

export const dynamic = "force-dynamic";

// Branded PNG for a single pick, used by the dashboard Share tab and the share
// buttons on the public profile. Publicly shareable. A still-locked premium pick
// (pending, premium, before its unlock time) renders a teaser that reveals
// nothing about the play — settled and free picks render in full.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pick = await prisma.pick.findUnique({
    where: { id },
    include: { handicapper: { select: { displayName: true, handle: true, suspendedAt: true } } },
  });

  if (!pick || !pick.handicapper || pick.handicapper.suspendedAt) {
    return new Response("Not found", { status: 404 });
  }

  // Anonymous viewer (unlocked=false): a premium pick that hasn't reached its
  // reveal time renders as a locked teaser.
  const locked = isPickLocked(pick, false);

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
      locked,
    }),
    SHARE_CARD_SIZE
  );
}
