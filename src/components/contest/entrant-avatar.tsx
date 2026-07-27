"use client";

import { useState } from "react";
import Image from "next/image";
import { entrantInitials } from "@/lib/contest-avatar";
import { cn } from "@/lib/utils";

// Hosts whitelisted in next.config's images.remotePatterns. Anything else
// renders as a plain <img> rather than throwing at render time.
const OPTIMIZABLE_HOST =
  /(^|\.)(public\.blob\.vercel-storage\.com|googleusercontent\.com)$/i;

function isOptimizable(url: string): boolean {
  if (url.startsWith("/")) return true; // local BLOB_LOCAL_DIR upload
  try {
    return OPTIMIZABLE_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * An entrant's face on the contest surfaces. Falls back to initials on a tinted
 * circle when there's no picture — every entrant gets *something*, so a row
 * with no avatar doesn't collapse to a different height than one with.
 */
export function EntrantAvatar({
  name,
  avatarUrl,
  className,
  sizes = "40px",
}: {
  name: string;
  avatarUrl: string | null;
  /** Set the size here, e.g. "h-8 w-8". */
  className?: string;
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);
  const base = "relative shrink-0 overflow-hidden rounded-full bg-surface-raised";

  if (!avatarUrl || failed) {
    return (
      <span
        aria-hidden
        className={cn(
          base,
          "flex items-center justify-center font-display text-[0.7em] font-bold text-muted",
          className
        )}
      >
        {entrantInitials(name)}
      </span>
    );
  }

  if (isOptimizable(avatarUrl)) {
    return (
      <span className={cn(base, className)}>
        <Image
          src={avatarUrl}
          alt=""
          fill
          sizes={sizes}
          className="object-cover"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }

  return (
    <span className={cn(base, className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- non-whitelisted host */}
      <img
        src={avatarUrl}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
    </span>
  );
}
