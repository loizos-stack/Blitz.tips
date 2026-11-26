"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A player's headshot on a pick card.
 *
 * Deliberately NOT through next/image, for exactly the reason team-logo.tsx
 * gives for crests: Vercel's optimizer bills per distinct SOURCE image, and
 * every athlete in every league is another one. That quota has already been
 * exhausted once on this site, by images smaller than these — which is why
 * *.espncdn.com is absent from remotePatterns in next.config.ts, and why
 * adding it would be the wrong fix if this ever renders blank.
 *
 * The URL comes from espnHeadshotUrl, which asks ESPN's /combiner/ endpoint
 * for the size actually drawn. That matters more than it sounds: the plain
 * headshot path ignores `?w=` and serves the full original, so the same face is
 * 206KB there and 10.7KB through the combiner. A board of a dozen props is the
 * difference between 2.5MB of portraits and 130KB.
 *
 * Missing players 404 cleanly — ESPN has no headshot for plenty of people on
 * its own roster lists — so onError is the normal path, not an edge case, and
 * it falls back to initials rather than a broken-image icon.
 */
/**
 * ESPN pads; TheSportsDB does not.
 *
 * Measured over five NBA headshots, the player occupies 64-82% of an ESPN
 * frame but 79-92% of a TheSportsDB cutout, because ESPN's originals are not
 * square (Durant's is 600x436) and the combiner pads them to fit. Drawn in the
 * same 48px circle, the same player therefore looks smaller when ESPN answered
 * than when TheSportsDB did, and a board mixing the two sources looks like the
 * avatars are different sizes.
 *
 * Asking ESPN for `&scale=crop` is the obvious fix and the wrong one: it keeps
 * the subject's height and widens it by about 30%, which is a horizontal
 * stretch, not a crop. Everyone comes out broader in the face.
 *
 * So the image is zoomed uniformly inside the circle instead — same aspect
 * ratio, no distortion, and the padding is what gets clipped. 1.12 was chosen
 * to bring the ESPN band up to the cutout band without eating into the
 * players who were already well framed.
 */
const ESPN_PAD_COMPENSATION = "scale-[1.12]";

function isEspnHeadshot(src: string): boolean {
  return src.includes("espncdn.com");
}

export function PlayerHeadshot({
  src,
  name,
  className,
}: {
  src: string | null;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  if (!src || failed) {
    return (
      <span
        aria-hidden
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full",
          "bg-white/10 text-[0.6rem] font-bold text-muted",
          className
        )}
      >
        {initials}
      </span>
    );
  }

  return (
    // The circle is the wrapper, not the image. A transform on the image
    // itself would scale its own border-radius too and simply draw a bigger
    // circle; clipping has to happen on a parent that is not being scaled.
    <span
      className={cn(
        // A tinted disc, not decoration. The portraits are cut out on a
        // transparent background, so on a white card the player would float
        // with no edge and the ring that should define him would be
        // white-on-white.
        "relative block shrink-0 overflow-hidden rounded-full bg-surface-raised",
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- see the note above: optimizing sports images is what blew the image quota. */}
      <img
        src={src}
        // Empty on purpose. The player's name is already written next to this
        // in the selection text, so announcing it again is noise to a screen
        // reader.
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={cn(
          "h-full w-full object-cover",
          isEspnHeadshot(src) && ESPN_PAD_COMPENSATION
        )}
      />
    </span>
  );
}
