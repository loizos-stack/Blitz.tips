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

// Fighter-name key: folds diacritics (José → jose) before stripping to
// alphanumerics, so Odds API vs ESPN spellings line up.
export function fighterKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

interface EspnMmaCompetitor {
  athlete?: { displayName?: string; fullName?: string; shortName?: string };
}
interface EspnMmaEvent {
  competitions?: { competitors?: EspnMmaCompetitor[] }[];
}

/**
 * Set of fighter-name keys appearing on ESPN's *UFC* card. The Odds API's MMA
 * feed (`mma_mixed_martial_arts`) covers every promotion with no per-event
 * promotion tag, so we use this to keep only UFC bouts on the board and in the
 * pick forms. Best-effort and cached: an empty set (fetch failed / off week)
 * means "don't filter" so the board never goes unexpectedly dark.
 */
export async function getUfcFighterSet(): Promise<Set<string>> {
  const set = new Set<string>();
  try {
    const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard", {
      next: { revalidate: 60 * 60 },
    });
    if (!res.ok) return set;
    const data = (await res.json()) as { events?: EspnMmaEvent[] };

    for (const event of data.events ?? []) {
      for (const comp of event.competitions ?? []) {
        for (const c of comp.competitors ?? []) {
          const a = c.athlete;
          for (const n of [a?.displayName, a?.fullName, a?.shortName]) {
            if (n) set.add(fighterKey(n));
          }
        }
      }
    }
  } catch {
    // best-effort — never let a UFC-roster fetch break the board
  }
  return set;
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

interface EspnLinescore {
  value?: number;
}
interface EspnPeriodCompetitor {
  homeAway?: string;
  linescores?: EspnLinescore[];
  team?: { displayName?: string; shortDisplayName?: string; name?: string; location?: string; nickname?: string };
}
interface EspnPeriodEvent {
  id?: string;
  status?: { type?: { state?: string; completed?: boolean } };
  competitions?: { competitors?: EspnPeriodCompetitor[] }[];
}

/** Per-period scores for a finished game, in period order (Q1..Q4 / P1..P3 / innings). */
export interface PeriodScores {
  home: number[];
  away: number[];
  /** ESPN's event id, used to pull the box score for player props. */
  eventId?: string;
}

/**
 * Per-period scores for *finished* games in this sport, keyed by away|home team
 * pair (every name variant, like getLiveGameStates). The Odds API only returns
 * a final total, so this is what lets the settler grade 1st half / quarter /
 * period / 1st-5-innings markets. Free and best-effort: an empty map just means
 * those picks stay pending for manual grading.
 */
export async function getFinalPeriodScores(sport: PickSport): Promise<Map<string, PeriodScores>> {
  const map = new Map<string, PeriodScores>();
  const path = ESPN_PATH[sport];
  if (!path) return map;

  try {
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return map;
    const data = (await res.json()) as { events?: EspnPeriodEvent[] };

    for (const event of data.events ?? []) {
      if (!event.status?.type?.completed) continue; // finished games only
      const competitors = event.competitions?.[0]?.competitors ?? [];
      const home = competitors.find((c) => c.homeAway === "home");
      const away = competitors.find((c) => c.homeAway === "away");
      if (!home?.team || !away?.team) continue;

      const homeLine = (home.linescores ?? []).map((l) => Number(l.value ?? 0));
      const awayLine = (away.linescores ?? []).map((l) => Number(l.value ?? 0));
      // A mismatched breakdown can't be summed; an empty one is still useful
      // because the event id alone lets us pull the box score for player props.
      if (homeLine.length !== awayLine.length) continue;

      const scores: PeriodScores = { home: homeLine, away: awayLine, eventId: event.id };
      const homeNames = [
        home.team.displayName,
        home.team.shortDisplayName,
        home.team.name,
        home.team.location,
        home.team.nickname,
      ];
      const awayNames = [
        away.team.displayName,
        away.team.shortDisplayName,
        away.team.name,
        away.team.location,
        away.team.nickname,
      ];
      for (const h of homeNames) {
        for (const a of awayNames) {
          if (h && a) map.set(livePairKey(a, h), scores);
        }
      }
    }
  } catch {
    // best-effort — a failed fetch just leaves period picks for manual grading
  }
  return map;
}

// --- Player box scores (for prop grading) -----------------------------------

/**
 * Canonical per-player stats we can grade a prop against. Sport-specific ESPN
 * box-score columns are normalized onto these names so the grader doesn't need
 * to know each sport's labels.
 */
export type StatLine = Record<string, number>;

// ESPN box-score column key -> our canonical stat name, per sport family. ESPN
// gives each category a `keys` array aligned with every athlete's `stats` array.
// Combined columns ("7-12") are split by taking the made value.
const STAT_KEY_MAP: Record<string, string> = {
  // Basketball
  points: "points",
  rebounds: "rebounds",
  assists: "assists",
  steals: "steals",
  blocks: "blocks",
  turnovers: "turnovers",
  "threePointFieldGoalsMade-threePointFieldGoalsAttempted": "threes",
  // Football — passing
  yards: "yards", // disambiguated by category below
  completions: "passCompletions",
  "completions-passingAttempts": "passCompletions",
  passingTouchdowns: "passTds",
  interceptions: "interceptions",
  // Football — rushing / receiving
  carries: "rushAttempts",
  rushingAttempts: "rushAttempts",
  receptions: "receptions",
  // Hockey
  goals: "goals",
  shotsTotal: "shots",
  shots: "shots",
  saves: "saves",
  // Baseball — batting
  hits: "hits",
  homeRuns: "homeRuns",
  RBIs: "rbis",
  rbi: "rbis",
  runs: "runs",
  // Baseball — pitching
  strikeouts: "strikeouts",
  walks: "walks",
  earnedRuns: "earnedRuns",
};

// Football/baseball report the same column name in several categories, so the
// category disambiguates it (ESPN category names are lowercase: "passing",
// "rushing", "receiving", "batting", "pitching").
const CATEGORY_YARDS: Record<string, string> = {
  passing: "passYards",
  rushing: "rushYards",
  receiving: "recYards",
};
const CATEGORY_TDS: Record<string, string> = {
  passing: "passTds",
  rushing: "rushTds",
  receiving: "recTds",
};

function statNumber(raw: string | undefined): number | null {
  if (raw == null) return null;
  // "7-12" (made-attempted) grades on the made value; "34" is plain.
  const made = raw.includes("-") ? raw.split("-")[0] : raw;
  const n = Number(made);
  return Number.isFinite(n) ? n : null;
}

interface EspnAthleteRow {
  athlete?: { displayName?: string; shortName?: string; fullName?: string };
  stats?: string[];
}
interface EspnStatCategory {
  name?: string;
  keys?: string[];
  athletes?: EspnAthleteRow[];
}
interface EspnBoxTeam {
  statistics?: EspnStatCategory[];
}

/**
 * Per-player stat lines for a finished game, keyed by normalized player name
 * (fighterKey folds accents/punctuation). Pulled from ESPN's free summary
 * endpoint. Empty map on any failure — prop picks then stay pending for manual
 * grading rather than being guessed.
 */
export async function getPlayerStats(sport: PickSport, espnEventId: string): Promise<Map<string, StatLine>> {
  const out = new Map<string, StatLine>();
  const path = ESPN_PATH[sport];
  if (!path || !espnEventId) return out;

  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${path}/summary?event=${espnEventId}`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return out;
    const data = (await res.json()) as { boxscore?: { players?: EspnBoxTeam[] } };

    for (const team of data.boxscore?.players ?? []) {
      for (const category of team.statistics ?? []) {
        const keys = category.keys ?? [];
        const categoryName = (category.name ?? "").toLowerCase();
        for (const row of category.athletes ?? []) {
          const name = row.athlete?.displayName ?? row.athlete?.fullName ?? row.athlete?.shortName;
          if (!name || !row.stats) continue;
          const key = fighterKey(name);
          const line = out.get(key) ?? {};

          keys.forEach((espnKey, i) => {
            const value = statNumber(row.stats?.[i]);
            if (value === null) return;
            // Category-scoped columns first (yards/TDs mean different things in
            // passing vs rushing vs receiving), then the global mapping.
            let canonical: string | undefined;
            if (espnKey === "yards") canonical = CATEGORY_YARDS[categoryName];
            else if (espnKey === "touchdowns") canonical = CATEGORY_TDS[categoryName];
            else canonical = STAT_KEY_MAP[espnKey];
            if (!canonical) return;
            // A player can appear in several categories; sum rather than clobber
            // (e.g. rushing + receiving TDs both feed "anytime TD").
            line[canonical] = (line[canonical] ?? 0) + value;
          });

          out.set(key, line);
        }
      }
    }
  } catch {
    // best-effort — a failed box score just leaves props for manual grading
  }
  return out;
}
