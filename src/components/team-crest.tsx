"use client";

import { useEffect, useState } from "react";
import type { PickSport } from "@prisma/client";
import { TeamLogo } from "@/components/team-logo";

// Process-lifetime memo so a team typed/added repeatedly is only fetched once.
const cache = new Map<string, string | null>();

// Resolves a single team's crest by name via /api/team-logo (ESPN + TheSportsDB)
// and renders it, falling back to the sport icon while loading or on a miss.
// Used in the posting forms where only the typed/selected name is known.
export function TeamCrest({
  sport,
  name,
  className,
}: {
  sport: string;
  name: string;
  className?: string;
}) {
  const key = `${sport}|${name.trim().toLowerCase()}`;
  const [url, setUrl] = useState<string | null>(() => cache.get(key) ?? null);

  useEffect(() => {
    const trimmed = name.trim();
    const cached = cache.get(key);
    let cancelled = false;
    // All state updates run inside the timeout callback (async) to stay clear of
    // the set-state-in-effect rule; cache hits/empties fire on the next tick.
    const delay = cached !== undefined || !trimmed ? 0 : 300;
    const timer = setTimeout(async () => {
      if (!trimmed) {
        if (!cancelled) setUrl(null);
        return;
      }
      if (cache.has(key)) {
        if (!cancelled) setUrl(cache.get(key) ?? null);
        return;
      }
      try {
        const res = await fetch(
          `/api/team-logo?sport=${encodeURIComponent(sport)}&name=${encodeURIComponent(trimmed)}`
        );
        const body = await res.json().catch(() => ({}));
        const resolved = typeof body?.url === "string" ? body.url : null;
        cache.set(key, resolved);
        if (!cancelled) setUrl(resolved);
      } catch {
        if (!cancelled) setUrl(null);
      }
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, name, sport]);

  return <TeamLogo sport={sport as PickSport} logoUrl={url} className={className} />;
}
