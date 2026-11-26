"use client";

import { PlayerHeadshot } from "@/components/player-headshot";

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
  playerName,
  photoUrl,
  teamAbbr,
  size = "sm",
}: {
  playerName: string | null;
  /** Resolved when the pick was written — ESPN or TheSportsDB, it doesn't matter here. */
  photoUrl?: string | null;
  /** The player's club, when the source knew it. */
  teamAbbr?: string | null;
  /**
   * "lg" makes the player the subject of the card rather than one chip in a
   * row of them. 48px and not larger on purpose: the stored ESPN URL asks the
   * combiner for 96px, so 48 is exactly 2x and stays crisp on a retina screen,
   * where 56 or 64 would be upscaled and soft. Picks written from here on ask
   * for 160 and have the headroom; the ones already posted do not.
   */
  size?: "sm" | "lg";
}) {
  if (!playerName) return null;

  if (size === "lg") {
    return (
      <span className="inline-flex min-w-0 items-center gap-3">
        <PlayerHeadshot
          src={photoUrl ?? null}
          name={playerName}
          className="h-12 w-12 ring-2 ring-surface"
        />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-display text-base font-semibold">{playerName}</span>
          {teamAbbr && (
            <span className="truncate text-xs font-semibold uppercase tracking-wide text-muted">
              {teamAbbr}
            </span>
          )}
        </span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <PlayerHeadshot src={photoUrl ?? null} name={playerName} className="h-7 w-7" />
      <span className="font-display font-semibold">{playerName}</span>
      {teamAbbr && (
        // Which side of the matchup he is on. The fixture is printed directly
        // above, so the abbreviation is enough to place him and short enough
        // not to crowd the line.
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{teamAbbr}</span>
      )}
    </span>
  );
}
