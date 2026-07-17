import type { PickSport } from "@prisma/client";

// The Odds API scores endpoint returns only the score + completed flag — no game
// clock or period. ESPN's public scoreboard API (same source we use for crests)
// exposes an in-progress game's period and clock via `status.type.shortDetail`
// (e.g. "3rd Quarter - 5:23", "Top 5th", "Halftime", "45'+2'"). We fetch it
// best-effort and attach the detail string to live board games.

const ESPN_PATH: Partial<Record<PickSport, string>> = {
  NFL: "football/nfl",
  NBA: "basketball/nba",
  WNBA: "basketball/wnba",
  MLB: "baseball/mlb",
  NHL: "hockey/nhl",
  NCAAF: "football/college-football",
  NCAAB: "basketball/mens-college-basketball",
};

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Match key from the two team names, order-sensitive (away, home). */
export function livePairKey(away: string, home: string): string {
  return `${norm(away)}|${norm(home)}`;
}

interface EspnCompetitor {
  homeAway: "home" | "away";
  team?: { displayName?: string; shortDisplayName?: string; name?: string; location?: string; nickname?: string };
}
interface EspnEvent {
  status?: { type?: { state?: string; shortDetail?: string; detail?: string } };
  competitions?: { competitors?: EspnCompetitor[] }[];
}

/**
 * Map of live game detail strings ("3rd Qtr 5:23", "Top 5th", …) keyed by
 * away|home team pair, for in-progress games in this sport. Empty for sports
 * ESPN's single-slug scoreboard doesn't cover here (e.g. multi-league soccer),
 * or on any fetch error — the board just falls back to a plain LIVE badge.
 */
export async function getLiveGameStates(sport: PickSport): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const path = ESPN_PATH[sport];
  if (!path) return map;

  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return map;
    const data = (await res.json()) as { events?: EspnEvent[] };

    for (const event of data.events ?? []) {
      if (event.status?.type?.state !== "in") continue; // in-progress only
      const competitors = event.competitions?.[0]?.competitors ?? [];
      const home = competitors.find((c) => c.homeAway === "home")?.team;
      const away = competitors.find((c) => c.homeAway === "away")?.team;
      if (!home || !away) continue;
      const detail = event.status.type.shortDetail || event.status.type.detail || "";
      if (!detail) continue;

      // Store under every name variant so full-name (Odds API) vs short-name
      // matching still connects.
      const homeNames = [home.displayName, home.shortDisplayName, home.name, home.location, home.nickname];
      const awayNames = [away.displayName, away.shortDisplayName, away.name, away.location, away.nickname];
      for (const h of homeNames) {
        for (const a of awayNames) {
          if (h && a) map.set(livePairKey(a, h), detail);
        }
      }
    }
  } catch {
    // best-effort — never let a live-state fetch break the board
  }
  return map;
}
