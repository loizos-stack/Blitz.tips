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
    // eslint-disable-next-line @next/next/no-img-element -- see the note above: optimizing sports images is what blew the image quota.
    <img
      src={src}
      // Empty on purpose. The player's name is already written next to this in
      // the selection text, so announcing it again is noise to a screen reader.
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      // A disc behind the image, not decoration. Both sources hand back
      // cut-out portraits on a transparent background, so on a white card the
      // player floats with no edge — and the ring that should define him is
      // white-on-white. The tinted disc gives every headshot the same silhouette
      // whatever the source did with its background.
      className={cn("shrink-0 rounded-full bg-surface-raised object-cover", className)}
    />
  );
}
