import "server-only";
import type { MarketOption } from "@/lib/odds-api";

// Catalog of the extra markets we pull for a single event (player props for the
// US team sports; non-player markets for soccer) and how each maps to a pick.
//
// Kept deliberately curated to the liquid, widely-offered markets: every key we
// request is billed (markets × regions), and an unknown key 422s the whole
// per-event request — so this list is the single source of truth for what's
// safe to ask for. Featured markets (h2h/spreads/totals) are handled separately
// and always form the first "Game Lines" group.
//
// The result is a two-level tree the pick form renders as a nested accordion:
//   Group ("Game Lines" | "Player Props") → Section (one per market) → lines.

export interface MarketSection {
  key: string;
  label: string;
  options: MarketOption[];
}
export interface MarketGroup {
  key: string; // "game" | "props"
  label: string;
  sections: MarketSection[];
}

export type OddsGroup = "football" | "basketball" | "baseball" | "hockey" | "soccer" | "other";

export function oddsGroup(sportKey: string): OddsGroup {
  if (sportKey.startsWith("americanfootball")) return "football";
  if (sportKey.startsWith("basketball")) return "basketball";
  if (sportKey.startsWith("baseball")) return "baseball";
  if (sportKey.startsWith("icehockey")) return "hockey";
  if (sportKey.startsWith("soccer")) return "soccer";
  return "other";
}

interface MarketDef {
  key: string; // The Odds API market key
  label: string; // subsection label, e.g. "Passing Yards"
  betType: MarketOption["betType"];
}

// Additional markets per sport group. For the US sports these are all player
// props (each its own subsection under "Player Props"); for soccer they're the
// non-player markets, which sit as subsections under "Game Lines".
const CATALOG: Record<OddsGroup, MarketDef[]> = {
  football: [
    { key: "player_pass_yds", label: "Passing Yards", betType: "PROP" },
    { key: "player_pass_tds", label: "Passing TDs", betType: "PROP" },
    { key: "player_pass_completions", label: "Completions", betType: "PROP" },
    { key: "player_pass_attempts", label: "Pass Attempts", betType: "PROP" },
    { key: "player_pass_interceptions", label: "Interceptions", betType: "PROP" },
    { key: "player_rush_yds", label: "Rushing Yards", betType: "PROP" },
    { key: "player_rush_attempts", label: "Rush Attempts", betType: "PROP" },
    { key: "player_receptions", label: "Receptions", betType: "PROP" },
    { key: "player_reception_yds", label: "Receiving Yards", betType: "PROP" },
    { key: "player_anytime_td", label: "Anytime TD", betType: "PROP" },
    { key: "player_1st_td", label: "First TD", betType: "PROP" },
    { key: "player_last_td", label: "Last TD", betType: "PROP" },
  ],
  basketball: [
    { key: "player_points", label: "Points", betType: "PROP" },
    { key: "player_threes", label: "3-Pointers Made", betType: "PROP" },
    { key: "player_rebounds", label: "Rebounds", betType: "PROP" },
    { key: "player_assists", label: "Assists", betType: "PROP" },
    { key: "player_points_rebounds_assists", label: "Pts + Reb + Ast", betType: "PROP" },
    { key: "player_points_rebounds", label: "Pts + Reb", betType: "PROP" },
    { key: "player_points_assists", label: "Pts + Ast", betType: "PROP" },
    { key: "player_rebounds_assists", label: "Reb + Ast", betType: "PROP" },
    { key: "player_blocks", label: "Blocks", betType: "PROP" },
    { key: "player_steals", label: "Steals", betType: "PROP" },
  ],
  baseball: [
    { key: "batter_hits", label: "Hits", betType: "PROP" },
    { key: "batter_total_bases", label: "Total Bases", betType: "PROP" },
    { key: "batter_home_runs", label: "Home Runs", betType: "PROP" },
    { key: "batter_rbis", label: "RBIs", betType: "PROP" },
    { key: "batter_runs_scored", label: "Runs Scored", betType: "PROP" },
    { key: "batter_stolen_bases", label: "Stolen Bases", betType: "PROP" },
    { key: "pitcher_strikeouts", label: "Strikeouts", betType: "PROP" },
    { key: "pitcher_hits_allowed", label: "Hits Allowed", betType: "PROP" },
    { key: "pitcher_walks", label: "Walks", betType: "PROP" },
    { key: "pitcher_earned_runs", label: "Earned Runs", betType: "PROP" },
    { key: "pitcher_outs", label: "Outs", betType: "PROP" },
  ],
  hockey: [
    { key: "player_points", label: "Points", betType: "PROP" },
    { key: "player_goals", label: "Goals", betType: "PROP" },
    { key: "player_assists", label: "Assists", betType: "PROP" },
    { key: "player_shots_on_goal", label: "Shots on Goal", betType: "PROP" },
    { key: "player_blocked_shots", label: "Blocked Shots", betType: "PROP" },
    { key: "player_power_play_points", label: "Power Play Points", betType: "PROP" },
    { key: "player_total_saves", label: "Goalie Saves", betType: "PROP" },
    { key: "player_goal_scorer_anytime", label: "Anytime Goal", betType: "PROP" },
    { key: "player_goal_scorer_first", label: "First Goal", betType: "PROP" },
    { key: "player_goal_scorer_last", label: "Last Goal", betType: "PROP" },
  ],
  // Soccer: NON-player markets only, which sit under "Game Lines" as subsections
  // alongside the moneyline/handicap/total.
  soccer: [
    { key: "draw_no_bet", label: "Draw No Bet", betType: "PROP" },
    { key: "double_chance", label: "Double Chance", betType: "PROP" },
    { key: "btts", label: "Both Teams to Score", betType: "PROP" },
    { key: "team_totals", label: "Team Totals", betType: "TOTAL" },
    { key: "alternate_spreads", label: "Alternate Handicap", betType: "SPREAD" },
    { key: "alternate_totals", label: "Alternate Totals", betType: "TOTAL" },
  ],
  other: [],
};

/** The additional (non-featured) market keys to request for a sport. */
export function additionalMarketKeys(sportKey: string): string[] {
  return CATALOG[oddsGroup(sportKey)].map((d) => d.key);
}

// Raw shapes from the per-event odds endpoint (a superset of the board's: props
// carry a `description` = player/team name).
export interface RawOutcome {
  name: string;
  price: number;
  point?: number;
  description?: string;
}
export interface RawMarket {
  key: string;
  outcomes: RawOutcome[];
}

function featuredOption(marketKey: string, o: RawOutcome): MarketOption | null {
  if (marketKey === "h2h") {
    return { betType: "MONEYLINE", selection: `${o.name} ML`, odds: o.price };
  }
  if (marketKey === "spreads" && o.point !== undefined) {
    return {
      betType: "SPREAD",
      selection: `${o.name} ${o.point > 0 ? "+" : ""}${o.point}`,
      odds: o.price,
      point: o.point,
    };
  }
  if (marketKey === "totals" && o.point !== undefined) {
    return { betType: "TOTAL", selection: `${o.name} ${o.point}`, odds: o.price, point: o.point };
  }
  return null;
}

function additionalOption(def: MarketDef, o: RawOutcome): MarketOption {
  const player = o.description?.trim();
  let selection: string;
  if (player) {
    // Player/team-scoped prop. Over/Under lines carry a point; yes/anytime
    // markets don't.
    if (o.point !== undefined) {
      selection = `${player} ${o.name} ${o.point} ${def.label}`;
    } else {
      const suffix = o.name && !/^(yes|over)$/i.test(o.name) ? ` (${o.name})` : "";
      selection = `${player} ${def.label}${suffix}`;
    }
  } else if (o.point !== undefined) {
    const sign = def.betType === "SPREAD" && o.point > 0 ? "+" : "";
    selection = `${o.name} ${sign}${o.point} ${def.label}`;
  } else {
    selection = `${def.label}: ${o.name}`;
  }
  return { betType: def.betType, selection: selection.replace(/\s+/g, " ").trim(), odds: o.price, point: o.point };
}

/**
 * Turn one bookmaker's raw markets into the grouped tree. Game lines (moneyline
 * / spread-handicap / total) always come first; then player props (US sports)
 * as their own group, or the non-player soccer markets folded into Game Lines.
 * Deterministic order (featured first, then catalog order); empty sections drop.
 */
export function buildGroups(sportKey: string, markets: RawMarket[]): MarketGroup[] {
  const group = oddsGroup(sportKey);
  const isSoccer = group === "soccer";
  const byKey = new Map(markets.map((m) => [m.key, m] as const));

  const gameSections: MarketSection[] = [];
  const propSections: MarketSection[] = [];

  // Featured game lines, in a fixed, readable order.
  const featured: { key: string; apiKey: string; label: string }[] = [
    { key: "moneyline", apiKey: "h2h", label: isSoccer ? "Match Result (1X2)" : "Moneyline" },
    { key: "spread", apiKey: "spreads", label: isSoccer ? "Handicap" : "Spread" },
    { key: "total", apiKey: "totals", label: "Total" },
  ];
  for (const f of featured) {
    const m = byKey.get(f.apiKey);
    if (!m) continue;
    const options = m.outcomes
      .map((o) => featuredOption(f.apiKey, o))
      .filter((o): o is MarketOption => o !== null);
    if (options.length) gameSections.push({ key: f.key, label: f.label, options });
  }

  // Additional markets, in catalog order. Soccer's fold into Game Lines; every
  // other sport's are player props in their own group.
  for (const def of CATALOG[group]) {
    const m = byKey.get(def.key);
    if (!m) continue;
    const options = m.outcomes.map((o) => additionalOption(def, o));
    if (!options.length) continue;
    (isSoccer ? gameSections : propSections).push({ key: def.key, label: def.label, options });
  }

  const groups: MarketGroup[] = [];
  if (gameSections.length) groups.push({ key: "game", label: "Game Lines", sections: gameSections });
  if (propSections.length) groups.push({ key: "props", label: "Player Props", sections: propSections });
  return groups;
}
