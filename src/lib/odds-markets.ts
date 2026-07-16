import "server-only";
import type { MarketOption } from "@/lib/odds-api";

// Catalog of the extra markets we pull for a single event (player props for the
// US team sports; non-player markets for soccer) and how each maps to a pick.
//
// Kept deliberately curated to the liquid, widely-offered markets: every key we
// request is billed (markets × regions), and an unknown key 422s the whole
// per-event request — so this list is the single source of truth for what's
// safe to ask for. Featured markets (h2h/spreads/totals) are handled separately
// and always form the first "Game Lines" category.

export interface MarketCategory {
  key: string;
  label: string;
  options: MarketOption[];
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
  label: string; // short label used in the selection text, e.g. "Pass Yds"
  category: string; // category key (see CATEGORY_LABELS)
  betType: MarketOption["betType"];
}

// Display order + labels for categories. "game" is always shown first.
const CATEGORY_LABELS: Record<string, string> = {
  game: "Game Lines",
  alt: "Alternate Lines",
  // Football
  passing: "Passing",
  rushing: "Rushing",
  receiving: "Receiving",
  touchdowns: "Touchdowns",
  // Basketball
  scoring: "Scoring",
  boards_dimes: "Rebounds & Assists",
  combos: "Combos",
  defense: "Defense",
  // Baseball
  batting: "Batting",
  pitching: "Pitching",
  // Hockey
  skaters: "Skaters",
  goalies: "Goalies",
  goalscorers: "Goalscorers",
  // Soccer (non-player only)
  match: "Match Lines",
  goals: "Goals",
};

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

// Player props for US sports; non-player markets only for soccer.
const CATALOG: Record<OddsGroup, MarketDef[]> = {
  football: [
    { key: "player_pass_yds", label: "Pass Yds", category: "passing", betType: "PROP" },
    { key: "player_pass_tds", label: "Pass TDs", category: "passing", betType: "PROP" },
    { key: "player_pass_completions", label: "Completions", category: "passing", betType: "PROP" },
    { key: "player_pass_attempts", label: "Pass Attempts", category: "passing", betType: "PROP" },
    { key: "player_pass_interceptions", label: "Interceptions", category: "passing", betType: "PROP" },
    { key: "player_rush_yds", label: "Rush Yds", category: "rushing", betType: "PROP" },
    { key: "player_rush_attempts", label: "Rush Attempts", category: "rushing", betType: "PROP" },
    { key: "player_receptions", label: "Receptions", category: "receiving", betType: "PROP" },
    { key: "player_reception_yds", label: "Rec Yds", category: "receiving", betType: "PROP" },
    { key: "player_anytime_td", label: "Anytime TD", category: "touchdowns", betType: "PROP" },
    { key: "player_1st_td", label: "First TD", category: "touchdowns", betType: "PROP" },
    { key: "player_last_td", label: "Last TD", category: "touchdowns", betType: "PROP" },
  ],
  basketball: [
    { key: "player_points", label: "Points", category: "scoring", betType: "PROP" },
    { key: "player_threes", label: "3-Pointers", category: "scoring", betType: "PROP" },
    { key: "player_rebounds", label: "Rebounds", category: "boards_dimes", betType: "PROP" },
    { key: "player_assists", label: "Assists", category: "boards_dimes", betType: "PROP" },
    { key: "player_points_rebounds_assists", label: "Pts+Reb+Ast", category: "combos", betType: "PROP" },
    { key: "player_points_rebounds", label: "Pts+Reb", category: "combos", betType: "PROP" },
    { key: "player_points_assists", label: "Pts+Ast", category: "combos", betType: "PROP" },
    { key: "player_rebounds_assists", label: "Reb+Ast", category: "combos", betType: "PROP" },
    { key: "player_blocks", label: "Blocks", category: "defense", betType: "PROP" },
    { key: "player_steals", label: "Steals", category: "defense", betType: "PROP" },
  ],
  baseball: [
    { key: "batter_hits", label: "Hits", category: "batting", betType: "PROP" },
    { key: "batter_total_bases", label: "Total Bases", category: "batting", betType: "PROP" },
    { key: "batter_home_runs", label: "Home Runs", category: "batting", betType: "PROP" },
    { key: "batter_rbis", label: "RBIs", category: "batting", betType: "PROP" },
    { key: "batter_runs_scored", label: "Runs", category: "batting", betType: "PROP" },
    { key: "batter_stolen_bases", label: "Stolen Bases", category: "batting", betType: "PROP" },
    { key: "pitcher_strikeouts", label: "Strikeouts", category: "pitching", betType: "PROP" },
    { key: "pitcher_hits_allowed", label: "Hits Allowed", category: "pitching", betType: "PROP" },
    { key: "pitcher_walks", label: "Walks", category: "pitching", betType: "PROP" },
    { key: "pitcher_earned_runs", label: "Earned Runs", category: "pitching", betType: "PROP" },
    { key: "pitcher_outs", label: "Outs", category: "pitching", betType: "PROP" },
  ],
  hockey: [
    { key: "player_points", label: "Points", category: "skaters", betType: "PROP" },
    { key: "player_goals", label: "Goals", category: "skaters", betType: "PROP" },
    { key: "player_assists", label: "Assists", category: "skaters", betType: "PROP" },
    { key: "player_shots_on_goal", label: "Shots on Goal", category: "skaters", betType: "PROP" },
    { key: "player_blocked_shots", label: "Blocked Shots", category: "skaters", betType: "PROP" },
    { key: "player_power_play_points", label: "PP Points", category: "skaters", betType: "PROP" },
    { key: "player_total_saves", label: "Saves", category: "goalies", betType: "PROP" },
    { key: "player_goal_scorer_anytime", label: "Anytime Goal", category: "goalscorers", betType: "PROP" },
    { key: "player_goal_scorer_first", label: "First Goal", category: "goalscorers", betType: "PROP" },
    { key: "player_goal_scorer_last", label: "Last Goal", category: "goalscorers", betType: "PROP" },
  ],
  // Soccer: NON-player markets only (no player props), per product decision.
  soccer: [
    { key: "draw_no_bet", label: "Draw No Bet", category: "match", betType: "PROP" },
    { key: "double_chance", label: "Double Chance", category: "match", betType: "PROP" },
    { key: "btts", label: "Both Teams to Score", category: "goals", betType: "PROP" },
    { key: "team_totals", label: "Team Total", category: "goals", betType: "TOTAL" },
    { key: "alternate_spreads", label: "Alt Spread", category: "alt", betType: "SPREAD" },
    { key: "alternate_totals", label: "Alt Total", category: "alt", betType: "TOTAL" },
  ],
  other: [],
};

/** The additional (non-featured) market keys to request for a sport, comma-safe. */
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
 * Turn one bookmaker's raw markets into ordered, de-duplicated categories:
 * "Game Lines" first (from featured markets), then the sport's prop/soccer
 * categories. Empty categories are dropped.
 */
export function buildCategories(sportKey: string, markets: RawMarket[]): MarketCategory[] {
  const defByKey = new Map(CATALOG[oddsGroup(sportKey)].map((d) => [d.key, d]));
  const byCategory = new Map<string, MarketOption[]>();

  const push = (cat: string, opt: MarketOption | null) => {
    if (!opt) return;
    const list = byCategory.get(cat) ?? [];
    list.push(opt);
    byCategory.set(cat, list);
  };

  for (const market of markets) {
    if (market.key === "h2h" || market.key === "spreads" || market.key === "totals") {
      for (const o of market.outcomes) push("game", featuredOption(market.key, o));
      continue;
    }
    const def = defByKey.get(market.key);
    if (!def) continue; // a market we didn't ask for / don't map
    for (const o of market.outcomes) push(def.category, additionalOption(def, o));
  }

  return CATEGORY_ORDER.filter((key) => (byCategory.get(key)?.length ?? 0) > 0).map((key) => ({
    key,
    label: CATEGORY_LABELS[key],
    options: byCategory.get(key)!,
  }));
}
