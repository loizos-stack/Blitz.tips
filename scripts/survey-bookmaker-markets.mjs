#!/usr/bin/env node
/**
 * Survey which sportsbook offers the most markets, per sport and overall.
 *
 * The Odds API only reveals a bookmaker's market coverage in the response, so
 * the only way to answer "who offers the most markets" is to request a broad
 * market list for a real event and count what each book actually returns.
 *
 * COST: the per-event odds endpoint bills [markets requested] x [regions].
 * This script therefore samples ONE event per sport and prints a cost estimate
 * before doing anything. It is a dry run unless you pass --run.
 *
 * Usage:
 *   THE_ODDS_API_KEY=xxx node scripts/survey-bookmaker-markets.mjs            # dry run (free)
 *   THE_ODDS_API_KEY=xxx node scripts/survey-bookmaker-markets.mjs --run      # execute
 *   ... --sports=americanfootball_nfl,basketball_nba   # limit the sample
 *   ... --regions=us,us2                               # default us,us2
 */

const API = process.env.ODDS_API_BASE ?? "https://api.the-odds-api.com/v4";
const KEY =
  process.env.THE_ODDS_API_KEY ?? process.env.ODDS_API_KEY ?? process.env.THEODDS_API_KEY;

if (!KEY) {
  console.error("Missing THE_ODDS_API_KEY (or ODDS_API_KEY) in the environment.");
  process.exit(1);
}

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
};
const RUN = args.includes("--run");
const REGIONS = flag("regions", "us,us2");

// Market keys by sport group. Kept to widely-offered keys — an unknown key
// 422s the whole request. Mirrors src/lib/odds-markets.ts plus the featured
// markets, which are what most books price.
const FEATURED = ["h2h", "spreads", "totals"];
const ALT = ["alternate_spreads", "alternate_totals", "team_totals"];
const BY_GROUP = {
  americanfootball: [
    ...FEATURED, ...ALT,
    "player_pass_yds", "player_pass_tds", "player_pass_attempts", "player_pass_completions",
    "player_pass_interceptions", "player_rush_yds", "player_rush_attempts", "player_reception_yds",
    "player_receptions", "player_anytime_td", "player_1st_td", "player_last_td",
  ],
  basketball: [
    ...FEATURED, ...ALT,
    "player_points", "player_rebounds", "player_assists", "player_threes", "player_blocks",
    "player_steals", "player_points_rebounds", "player_points_assists", "player_rebounds_assists",
    "player_points_rebounds_assists",
  ],
  baseball: [
    ...FEATURED, ...ALT,
    "batter_hits", "batter_home_runs", "batter_rbis", "batter_runs_scored", "batter_total_bases",
    "batter_stolen_bases", "pitcher_strikeouts", "pitcher_outs", "pitcher_hits_allowed",
    "pitcher_earned_runs", "pitcher_walks",
  ],
  icehockey: [
    ...FEATURED, ...ALT,
    "player_points", "player_goals", "player_assists", "player_shots_on_goal",
    "player_blocked_shots", "player_total_saves", "player_power_play_points",
    "player_goal_scorer_anytime", "player_goal_scorer_first", "player_goal_scorer_last",
  ],
  soccer: [...FEATURED, "btts", "double_chance", "draw_no_bet", "team_totals"],
};

const groupOf = (sportKey) => {
  for (const g of Object.keys(BY_GROUP)) if (sportKey.startsWith(g)) return g;
  return null;
};

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${(await res.text()).slice(0, 200)}`);
  return {
    body: await res.json(),
    used: res.headers.get("x-requests-used"),
    remaining: res.headers.get("x-requests-remaining"),
  };
}

// 1. Active, in-season sports (this endpoint is free).
const { body: allSports, remaining } = await getJson(`${API}/sports?apiKey=${KEY}`);
const wanted = flag("sports", "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const sports = allSports
  .filter((s) => s.active && !s.has_outrights && groupOf(s.key))
  .filter((s) => (wanted.length ? wanted.includes(s.key) : true));

const regionCount = REGIONS.split(",").filter(Boolean).length;
let estimate = 0;
for (const s of sports) estimate += BY_GROUP[groupOf(s.key)].length * regionCount;

console.log(`Quota remaining: ${remaining ?? "unknown"}`);
console.log(`Sports to sample: ${sports.length} (${sports.map((s) => s.key).join(", ")})`);
console.log(`Regions: ${REGIONS}`);
console.log(`Estimated cost: ~${estimate} credits (1 event per sport, markets x regions)\n`);

if (!RUN) {
  console.log("Dry run — nothing was requested. Re-run with --run to execute.");
  process.exit(0);
}

// bookmaker key -> { title, markets:Set, sports:Set, outcomes:number }
const books = new Map();
const perSport = [];

for (const sport of sports) {
  const group = groupOf(sport.key);
  const markets = BY_GROUP[group];
  try {
    const { body: events } = await getJson(`${API}/sports/${sport.key}/events?apiKey=${KEY}`);
    if (!events?.length) {
      console.log(`- ${sport.key}: no upcoming events, skipped`);
      continue;
    }
    const eventId = events[0].id;
    const url =
      `${API}/sports/${sport.key}/events/${eventId}/odds` +
      `?apiKey=${KEY}&regions=${REGIONS}&markets=${markets.join(",")}&oddsFormat=american`;
    const { body: ev, remaining: rem } = await getJson(url);

    const row = { sport: sport.key, title: sport.title, books: [] };
    for (const b of ev.bookmakers ?? []) {
      const entry = books.get(b.key) ?? { title: b.title, markets: new Set(), sports: new Set(), outcomes: 0 };
      for (const m of b.markets ?? []) {
        entry.markets.add(m.key);
        entry.outcomes += (m.outcomes ?? []).length;
      }
      entry.sports.add(sport.key);
      books.set(b.key, entry);
      row.books.push({ key: b.key, markets: (b.markets ?? []).length });
    }
    row.books.sort((a, b) => b.markets - a.markets);
    perSport.push(row);
    console.log(
      `- ${sport.key.padEnd(28)} top: ${row.books.slice(0, 3).map((x) => `${x.key}(${x.markets})`).join(", ") || "none"}   [quota left ${rem}]`
    );
  } catch (err) {
    console.log(`- ${sport.key}: FAILED — ${err.message}`);
  }
}

console.log("\n=== OVERALL: distinct markets offered per sportsbook ===");
const ranked = [...books.entries()]
  .map(([key, v]) => ({
    key,
    title: v.title,
    distinctMarkets: v.markets.size,
    sportsCovered: v.sports.size,
    outcomes: v.outcomes,
  }))
  .sort((a, b) => b.distinctMarkets - a.distinctMarkets || b.sportsCovered - a.sportsCovered);

console.table(ranked);

if (ranked[0]) {
  console.log(
    `\nWinner: ${ranked[0].title} (${ranked[0].key}) — ${ranked[0].distinctMarkets} distinct markets across ${ranked[0].sportsCovered} sports.`
  );
}
console.log("\nPer-sport detail:");
for (const r of perSport) {
  console.log(`\n${r.title} (${r.sport})`);
  for (const b of r.books.slice(0, 8)) console.log(`  ${String(b.markets).padStart(3)}  ${b.key}`);
}
