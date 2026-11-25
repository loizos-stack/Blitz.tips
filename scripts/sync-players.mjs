/**
 * Fills the Player table from ESPN, so pick cards can show a player's face.
 *
 *   node scripts/sync-players.mjs            # all pro leagues
 *   node scripts/sync-players.mjs NBA NHL    # just these
 *
 * Needs DATABASE_URL. Safe to re-run: every row is an upsert keyed on
 * (sport, espnId), so a second run refreshes names and drops nobody.
 *
 * Run it when a season's rosters turn over. There is no cron for it on purpose
 * — rosters move slowly, the whole sweep is ~40 requests, and a scheduled job
 * that silently half-fails is worse than one you run and watch.
 *
 * ## Why only these leagues
 *
 * ESPN's athlete endpoint returns a historical archive, not a current roster,
 * and it ignores `active=true` in the query string — you get the same count
 * either way and have to filter on each row's own `active` field. For the pro
 * leagues that is fine. For the others it is not:
 *
 *   NBA       767        NCAAB    12,665
 *   NHL     2,869        NFL      20,325
 *   MLB    13,143        NCAAF   254,099
 *
 * College football is a quarter of a million rows to put a face on a bet
 * nobody has placed yet. The soccer leagues are worse than large — 7,000+ per
 * league with ZERO rows marked active and no headshot behind any id checked.
 * Soccer and Euroleague photos do exist at TheSportsDB (~15KB via its
 * "/preview" suffix), which is the route if those sports are ever wanted.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** sport -> ESPN's {sport}/{league} path. Keep in step with lib/player-photos.ts. */
const LEAGUES = {
  NFL: "football/nfl",
  NBA: "basketball/nba",
  WNBA: "basketball/wnba",
  MLB: "baseball/mlb",
  NHL: "hockey/nhl",
};

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

/** Must match normalizePlayerName in src/lib/player-photos.ts exactly. */
function normalizePlayerName(name) {
  const words = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ");
  while (words.length > 1 && SUFFIXES.has(words[words.length - 1])) words.pop();
  return words.join(" ");
}

const PAGE = 1000;

async function fetchLeague(path) {
  const athletes = [];
  let page = 1;
  let pageCount = 1;

  do {
    const url = `https://sports.core.api.espn.com/v3/sports/${path}/athletes?limit=${PAGE}&page=${page}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${path} page ${page}: HTTP ${res.status}`);
    const body = await res.json();

    pageCount = body.pageCount ?? 1;
    for (const a of body.items ?? []) {
      // `active` is the only thing separating this season's roster from every
      // player who ever appeared. ESPN won't filter it server-side.
      if (!a.active) continue;
      const fullName = a.fullName || a.displayName;
      if (!a.id || !fullName) continue;
      athletes.push({ espnId: String(a.id), fullName });
    }
    page += 1;
  } while (page <= pageCount);

  return athletes;
}

const requested = process.argv.slice(2).map((s) => s.toUpperCase());
const sports = requested.length ? requested : Object.keys(LEAGUES);

for (const sport of sports) {
  const path = LEAGUES[sport];
  if (!path) {
    console.error(`${sport}: not a league with photos — skipping. Known: ${Object.keys(LEAGUES).join(", ")}`);
    continue;
  }

  process.stdout.write(`${sport.padEnd(5)} fetching… `);
  const athletes = await fetchLeague(path);
  process.stdout.write(`${athletes.length} active\n`);

  if (athletes.length === 0) {
    // WNBA returned 14 athletes out of season. Worth saying out loud rather
    // than reporting a clean zero: an empty league means no photos, and the
    // reason is upstream, not here.
    console.error(`  ${sport}: ESPN listed no active athletes. Leaving existing rows alone.`);
    continue;
  }

  let written = 0;
  for (const a of athletes) {
    const normalizedName = normalizePlayerName(a.fullName);
    if (!normalizedName) continue;
    await prisma.player.upsert({
      where: { sport_espnId: { sport, espnId: a.espnId } },
      create: { sport, espnId: a.espnId, fullName: a.fullName, normalizedName, active: true },
      update: { fullName: a.fullName, normalizedName, active: true },
    });
    written += 1;
  }

  // How many of those names are shared. The resolver refuses to pick between
  // duplicates, so this is the number of players who will never get a photo —
  // worth printing, because if it is ever large the matching needs rethinking
  // rather than quietly failing.
  const dupes = await prisma.player.groupBy({
    by: ["normalizedName"],
    where: { sport },
    _count: { normalizedName: true },
    having: { normalizedName: { _count: { gt: 1 } } },
  });

  console.log(`  ${written} rows written, ${dupes.length} ambiguous name(s) will show no photo`);
}

await prisma.$disconnect();
