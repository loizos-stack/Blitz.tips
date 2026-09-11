"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A country flag, drawn as an image rather than an emoji.
 *
 * Emoji flags look like the obvious choice and are the reason the flags were
 * invisible for most visitors: Windows ships no country-flag emoji at all, so a
 * regional-indicator pair renders there as two bare letters, and the England and
 * Scotland subdivision sequences render as nothing whatsoever. A flag that only
 * shows up on Macs and phones isn't a flag.
 *
 * flagcdn serves the images; the CSP already allows `img-src ... https:`. A
 * missing or blocked flag hides itself, leaving the country name on its own,
 * which reads fine — the flag is decoration, the name carries the meaning.
 */
export function FlagIcon({ code, className }: { code: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!code || failed) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- external flag CDN, not in images.remotePatterns
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      alt=""
      aria-hidden
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      // Flags are wider than they are tall and vary in ratio (Switzerland is
      // square, Qatar is 11:28), so fix the height and let the width follow.
      className={cn("inline-block h-3 w-auto shrink-0 rounded-[1px] object-contain", className)}
    />
  );
}
