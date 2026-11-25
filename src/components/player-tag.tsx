"use client";

import { PlayerHeadshot } from "@/components/player-headshot";
import { espnHeadshotUrl } from "@/lib/player-photos";
import type { PickSport } from "@prisma/client";

/**
 * Who a player prop is on: the face, then the name.
 *
 * One component rather than the same few lines in each card, because the cards
 * had already drifted once — the headshot went into pick-card and not into
 * handicapper-pick-row, so the pick a handicapper looks at on their own
 * dashboard was the one place the feature appeared to do nothing.
 *
 * The NAME is the part that must always render. A prop's selection text is
 * just the line ("Over 29.5 Points+Rebounds+Assists"); without this the card
 * never says who the bet is on, which is unreadable whether or not a photo
 * resolved. The photo is the decoration, and PlayerHeadshot already falls back
 * to initials when ESPN has nobody — so a missing match costs the picture and
 * never the information.
 */
export function PlayerTag({
  sport,
  playerName,
  playerEspnId,
}: {
  sport: PickSport;
  playerName: string | null;
  playerEspnId: string | null;
}) {
  if (!playerName) return null;

  return (
    <span className="inline-flex items-center gap-1.5">
      <PlayerHeadshot
        src={playerEspnId ? espnHeadshotUrl(sport, playerEspnId) : null}
        name={playerName}
        className="h-7 w-7"
      />
      <span className="font-display font-semibold">{playerName}</span>
    </span>
  );
}
