"use client";

import { useState } from "react";
import Image from "next/image";
import type { PickSport } from "@prisma/client";
import { SportIcon } from "@/components/sport-icon";
import { cn } from "@/lib/utils";

// Hosts we've whitelisted in next.config's images.remotePatterns. Only these get
// routed through next/image; any other host renders as a plain <img> so an
// unconfigured source can never throw at render time.
const OPTIMIZABLE_HOST = /(^|\.)(espncdn\.com|thesportsdb\.com)$/i;

function isOptimizable(url: string): boolean {
  try {
    return OPTIMIZABLE_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
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

  // Optimized (resized to a small badge, WebP/AVIF, long-cached) for the known
  // logo CDNs; a plain lazy <img> otherwise. onError degrades to the sport icon.
  if (isOptimizable(logoUrl)) {
    return (
      <span className={cn("relative inline-block overflow-hidden", className)}>
        <Image src={logoUrl} alt="" fill sizes="40px" className="object-contain" onError={() => setFailed(true)} />
      </span>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element -- external, non-whitelisted CDN badge (rare fallback host)
  return <img src={logoUrl} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className={cn("object-contain", className)} />;
}
