"use client";

import { useEffect, useState } from "react";
import type { PickSport } from "@prisma/client";
import { SportIcon } from "@/components/sport-icon";

export function TeamLogo({ sport, logoUrl, className }: { sport: PickSport; logoUrl: string | null; className?: string }) {
  // Preload in a controlled effect rather than relying on the rendered <img>'s
  // native onError: a very fast failure (e.g. blocked host, instant 404) can
  // fire before React finishes hydrating and attaches the handler, leaving a
  // broken-image glyph stuck on screen instead of falling back.
  const [status, setStatus] = useState<"loading" | "ok" | "failed">(logoUrl ? "loading" : "failed");

  useEffect(() => {
    if (!logoUrl) return;
    const img = new window.Image();
    img.onload = () => setStatus("ok");
    img.onerror = () => setStatus("failed");
    img.src = logoUrl;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [logoUrl]);

  if (status !== "ok") {
    return (
      <span className={`flex items-center justify-center rounded-full bg-surface-raised text-muted ${className ?? ""}`}>
        <SportIcon sport={sport} className="h-1/2 w-1/2" />
      </span>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element -- external, unofficial CDN; next/image would need remotePatterns and adds no value for a tiny badge
  return <img src={logoUrl ?? undefined} alt="" className={`object-contain ${className ?? ""}`} />;
}
