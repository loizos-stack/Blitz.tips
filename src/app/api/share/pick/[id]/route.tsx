import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { SPORT_LABELS, BET_TYPE_LABELS } from "@/lib/utils";
import { isPickLocked } from "@/lib/pick-visibility";
import { getTeamLogoUrl } from "@/lib/team-logos";
import { toDataUris } from "@/lib/og-image";
import { pickCard, SHARE_CARD_SIZE } from "@/lib/share-cards";
import type { PickSport } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Kickoff, written out for the card.
 *
 * Fixed to UTC on purpose. The card is a PNG baked on a server and then looked
 * at by people in other time zones, possibly weeks later — there is no "the
 * viewer's clock" to use, so the only honest thing is to name the zone shown.
 */
function formatKickoff(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`
  );
}

/**
 * A crest for each side of the matchup, in the order the text names them.
 *
 * No home/away reordering here, unlike the on-site card: that one places the
 * crests around a fixture it lays out itself, while this prints the matchup
 * string verbatim. Following the text is what keeps crest and name together
 * for both "Away @ Home" and "Home vs Away" sports.
 */
function crestUrls(sport: PickSport, matchup: string): [string | null, string | null] {
  const [first, second] = matchup.split(/\s+(?:@|vs\.?|at)\s+/i);
  return [
    getTeamLogoUrl(sport, (first ?? "").trim()),
    getTeamLogoUrl(sport, (second ?? "").trim()),
  ];
}

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

  // A locked card shows none of this, so there is no reason to fetch any of it.
  const [awayLogo, homeLogo] = locked ? [null, null] : crestUrls(pick.sport, pick.matchup);
  const [playerPhotoDataUri, awayLogoDataUri, homeLogoDataUri] = await toDataUris([
    locked ? null : pick.playerPhotoUrl,
    awayLogo,
    homeLogo,
  ]);

  return new ImageResponse(
    pickCard({
      displayName: pick.handicapper.displayName,
      handle: pick.handicapper.handle,
      sportLabel: SPORT_LABELS[pick.sport] ?? pick.sport,
      league: pick.league,
      kickoff: formatKickoff(pick.eventStartsAt),
      betTypeLabel: BET_TYPE_LABELS[pick.betType] ?? null,
      matchup: pick.matchup,
      selection: pick.selection,
      odds: pick.odds,
      units: pick.units,
      result: pick.result,
      playerName: pick.playerName,
      playerTeam: pick.playerTeam,
      playerPhotoDataUri,
      awayLogoDataUri,
      homeLogoDataUri,
      locked,
    }),
    SHARE_CARD_SIZE
  );
}
