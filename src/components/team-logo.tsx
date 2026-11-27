"use client";

import { useState } from "react";
import type { PickSport } from "@prisma/client";
import { SportIcon } from "@/components/sport-icon";
import { cn } from "@/lib/utils";

/**
 * Team crests and competition badges, served straight from their CDN.
 *
 * Deliberately NOT through next/image. Vercel's optimizer bills per distinct
 * SOURCE image, and a sports site has an unbounded supply of them: every club
 * in every league the board touches is another one. Counting only the crests
 * reachable from here — the four US majors, the college sports, and ten soccer
 * leagues at ~18 clubs each — the figure is comfortably over a thousand, and
 * it grew again the day the board started falling back to ESPN for soccer.
 *
 * What that quota bought was nothing worth having. These are 5–20KB PNGs on a
 * CDN already built to serve them, drawn at 28–40px. Resizing them through a
 * paid optimizer saves a few kilobytes per crest and costs the entire monthly
 * allowance, so the plain tag wins on every axis that matters.
 *
 * `loading="lazy"` keeps a long board from fetching every crest at once, which
 * is where the real page-weight saving was anyway.
 */

/**
 * Competition badge for a league heading. Unlike TeamLogo there's no icon
 * fallback — a missing or broken badge renders nothing and the heading is just
 * its name, which reads fine on its own.
 */
export function LeagueBadge({ src, className }: { src: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- see the note above: optimizing crests is what blew the image quota.
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}

export function TeamLogo({
  sport,
  logoUrl,
  className,
}: {
  sport: PickSport;
  logoUrl: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!logoUrl || failed) {
    return (
      <span className={cn("flex items-center justify-center rounded-full bg-surface-raised text-muted", className)}>
        <SportIcon sport={sport} className="h-1/2 w-1/2" />
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- see the note above.
    <img
      src={logoUrl}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn("object-contain", className)}
    />
  );
}
