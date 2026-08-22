import "server-only";
import { oddsGroup } from "@/lib/odds-markets";

/**
 * Market keys the Blitz Odds watcher asks for, per depth tier.
 *
 * Deliberately separate from lib/odds-markets, which feeds the pick forms. Two
 * reasons, and both matter:
 *
 *  1. The watcher wants markets the pick form has no reason to carry — soccer
 *     corners and cards — and one unknown key 422s an entire per-event request.
 *     Adding unverified keys to the shared catalog would put the pick form at
 *     risk of losing every market on a game to a typo in a corners key.
 *  2. The tiers here exist to bound spend, which is not a concern the pick form
 *     has: it fetches one event on demand, the watcher fetches many on a timer.
 *
 * VERIFICATION. The keys marked `verified: false` below are documented by the
 * upstream but have never returned data to this key — the sandbox this was
 * written in cannot reach the feed. They are grouped into their own request so
 * a wrong key costs that tier and nothing else, and the poller records which
 * keys actually came back, which is what the panel's "verified" column shows.
 * Treat an unverified key as a hypothesis until the panel says otherwise.
 */

export interface WatchMarket {
  key: string;
  label: string;
  verified: boolean;
}

/** Featured markets — one bulk request per league covers every event. Cheap. */
export const GAME_LINE_MARKETS: WatchMarket[] = [
  { key: "h2h", label: "Moneyline", verified: true },
  { key: "spreads", label: "Spread", verified: true },
  { key: "totals", label: "Total", verified: true },
];

/** Alternate lines and period markets. Per-event. */
const ALTERNATES: Record<string, WatchMarket[]> = {
  football: [
    { key: "alternate_spreads", label: "Alternate Spread", verified: true },
    { key: "alternate_totals", label: "Alternate Total", verified: true },
    { key: "team_totals", label: "Team Total", verified: true },
    { key: "h2h_h1", label: "1st Half Moneyline", verified: true },
    { key: "spreads_h1", label: "1st Half Spread", verified: true },
    { key: "totals_h1", label: "1st Half Total", verified: true },
  ],
  basketball: [
    { key: "alternate_spreads", label: "Alternate Spread", verified: true },
    { key: "alternate_totals", label: "Alternate Total", verified: true },
    { key: "team_totals", label: "Team Total", verified: true },
    { key: "h2h_h1", label: "1st Half Moneyline", verified: true },
    { key: "spreads_h1", label: "1st Half Spread", verified: true },
    { key: "totals_h1", label: "1st Half Total", verified: true },
  ],
  baseball: [
    { key: "alternate_spreads", label: "Alternate Run Line", verified: true },
    { key: "alternate_totals", label: "Alternate Total", verified: true },
    { key: "team_totals", label: "Team Total", verified: true },
    { key: "h2h_1st_5_innings", label: "1st 5 Innings Moneyline", verified: true },
    { key: "totals_1st_5_innings", label: "1st 5 Innings Total", verified: true },
  ],
  hockey: [
    { key: "alternate_spreads", label: "Alternate Puck Line", verified: true },
    { key: "alternate_totals", label: "Alternate Total", verified: true },
    { key: "team_totals", label: "Team Total", verified: true },
    { key: "h2h_p1", label: "1st Period Moneyline", verified: true },
    { key: "totals_p1", label: "1st Period Total", verified: true },
  ],
  soccer: [
    { key: "alternate_spreads", label: "Alternate Handicap", verified: true },
    { key: "alternate_totals", label: "Alternate Total", verified: true },
    { key: "team_totals", label: "Team Total", verified: true },
    { key: "btts", label: "Both Teams to Score", verified: true },
    { key: "double_chance", label: "Double Chance", verified: true },
    { key: "draw_no_bet", label: "Draw No Bet", verified: true },
    { key: "h2h_h1", label: "1st Half Result", verified: true },
    { key: "totals_h1", label: "1st Half Total", verified: true },
  ],
  other: [],
};

/** Player props. Per-event, US books. */
const PROPS: Record<string, WatchMarket[]> = {
  football: [
    { key: "player_pass_yds", label: "Passing Yards", verified: true },
    { key: "player_pass_tds", label: "Passing TDs", verified: true },
    { key: "player_rush_yds", label: "Rushing Yards", verified: true },
    { key: "player_receptions", label: "Receptions", verified: true },
    { key: "player_reception_yds", label: "Receiving Yards", verified: true },
    { key: "player_anytime_td", label: "Anytime TD", verified: true },
  ],
  basketball: [
    { key: "player_points", label: "Points", verified: true },
    { key: "player_rebounds", label: "Rebounds", verified: true },
    { key: "player_assists", label: "Assists", verified: true },
    { key: "player_threes", label: "3-Pointers Made", verified: true },
    { key: "player_points_rebounds_assists", label: "Pts + Reb + Ast", verified: true },
  ],
  baseball: [
    { key: "batter_hits", label: "Hits", verified: true },
    { key: "batter_total_bases", label: "Total Bases", verified: true },
    { key: "batter_home_runs", label: "Home Runs", verified: true },
    { key: "pitcher_strikeouts", label: "Strikeouts", verified: true },
  ],
  hockey: [
    { key: "player_points", label: "Points", verified: true },
    { key: "player_goals", label: "Goals", verified: true },
    { key: "player_assists", label: "Assists", verified: true },
    { key: "player_shots_on_goal", label: "Shots on Goal", verified: true },
    { key: "player_total_saves", label: "Goalie Saves", verified: true },
  ],
  // Soccer player props are documented by the upstream but unconfirmed against
  // this key — see the VERIFICATION note above.
  soccer: [
    { key: "player_goal_scorer_anytime", label: "Anytime Goalscorer", verified: false },
    { key: "player_first_goal_scorer", label: "First Goalscorer", verified: false },
    { key: "player_shots_on_target", label: "Shots on Target", verified: false },
    { key: "player_shots", label: "Shots", verified: false },
    { key: "player_assists", label: "Assists", verified: false },
  ],
  other: [],
};

/**
 * Soccer corners and cards.
 *
 * Their own tier, not folded into the soccer alternates, precisely because
 * these are the least-verified keys in the file: isolating them means a wrong
 * corners key cannot take the handicaps and totals down with it.
 */
export const SOCCER_EXTRA_MARKETS: WatchMarket[] = [
  { key: "totals_corners", label: "Total Corners", verified: false },
  { key: "spreads_corners", label: "Corners Handicap", verified: false },
  { key: "alternate_totals_corners", label: "Alternate Total Corners", verified: false },
  { key: "totals_cards", label: "Total Cards", verified: false },
  { key: "spreads_cards", label: "Cards Handicap", verified: false },
  { key: "player_to_receive_card", label: "Player to be Carded", verified: false },
  { key: "player_to_receive_red_card", label: "Player Red Card", verified: false },
];

export function alternateMarkets(sportKey: string): WatchMarket[] {
  return ALTERNATES[oddsGroup(sportKey)] ?? [];
}

export function propMarkets(sportKey: string): WatchMarket[] {
  return PROPS[oddsGroup(sportKey)] ?? [];
}

export function soccerExtraMarkets(sportKey: string): WatchMarket[] {
  return oddsGroup(sportKey) === "soccer" ? SOCCER_EXTRA_MARKETS : [];
}

/** Every market this file knows, for labelling a stored key in the feed. */
export function watchMarketLabel(key: string): string {
  for (const table of [GAME_LINE_MARKETS, SOCCER_EXTRA_MARKETS]) {
    const hit = table.find((m) => m.key === key);
    if (hit) return hit.label;
  }
  for (const group of Object.keys(ALTERNATES)) {
    const hit =
      ALTERNATES[group].find((m) => m.key === key) ?? PROPS[group].find((m) => m.key === key);
    if (hit) return hit.label;
  }
  return key;
}

/** Keys documented but not yet seen returning data on this subscription. */
export function unverifiedMarketKeys(): string[] {
  const out = new Set<string>();
  for (const table of [...Object.values(ALTERNATES), ...Object.values(PROPS)]) {
    for (const m of table) if (!m.verified) out.add(m.key);
  }
  for (const m of SOCCER_EXTRA_MARKETS) if (!m.verified) out.add(m.key);
  return [...out];
}
