/**
 * Reports what a SportsDataIO key actually unlocks.
 *
 *   SPORTSDATA_KEY=xxxxxxxx node scripts/probe-sportsdata.mjs
 *
 * SportsDataIO sells per sport *and* per feed — Scores, Odds, Projections and
 * Images are separate products — so "we have a SportsDataIO key" doesn't say
 * whether it can price a soccer match or return a player photo. Rather than
 * guess from a pricing page, this asks the API and prints what comes back.
 *
 * Reads only. Every request is a GET, nothing is written anywhere, and the key
 * is never printed.
 *
 * The endpoint paths are from their v3 layout and may not all be current. A 404
 * here means "that path is wrong", which is not the same as 401/403 meaning
 * "your key doesn't include this" — the script separates the two, because they
 * lead to different conclusions.
 */
const KEY = process.env.SPORTSDATA_KEY?.trim();
if (!KEY) {
  console.error("Set SPORTSDATA_KEY to your subscription key first.");
  process.exit(1);
}

const BASE = "https://api.sportsdata.io/v3";
const today = new Date().toISOString().slice(0, 10);

/** Sports to check. Trimmed to the ones this site actually carries. */
const SPORTS = ["nfl", "nba", "mlb", "nhl", "soccer", "mma"];

/**
 * Feed probes. `label` says what a success would buy us, so the output reads as
 * a capability list rather than a list of URLs.
 */
function probesFor(sport) {
  const soccer = sport === "soccer";
  return [
    { feed: "Scores", label: "teams + crests", path: `${BASE}/${sport}/scores/json/Teams` },
    {
      feed: "Scores",
      label: "games by date (final scores)",
      path: `${BASE}/${sport}/scores/json/${soccer ? "GamesByDate" : "ScoresByDate"}/${today}`,
    },
    {
      feed: "Odds",
      label: "sportsbook lines",
      path: `${BASE}/${sport}/odds/json/${soccer ? "GameOddsByDate" : "GameOddsByDate"}/${today}`,
    },
    ...(soccer
      ? [{ feed: "Scores", label: "competition list (league breadth)", path: `${BASE}/soccer/scores/json/Competitions` }]
      : []),
  ];
}

async function probe(url) {
  try {
    const res = await fetch(`${url}?key=${encodeURIComponent(KEY)}`, {
      headers: { "Ocp-Apim-Subscription-Key": KEY },
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* keep the raw text for the error line */
    }
    return { status: res.status, json, text };
  } catch (e) {
    return { status: 0, json: null, text: String(e) };
  }
}

/** Pulls out the few fields that decide whether this is usable, not the whole payload. */
function summarise(json) {
  if (!Array.isArray(json)) return json && typeof json === "object" ? "object" : "empty";
  if (json.length === 0) return "0 rows (no games today — try again on a match day)";
  const first = json[0];
  const keys = Object.keys(first);

  const bits = [`${json.length} rows`];

  // The id that would let auto-settle match a pick to a final score.
  const idKey = ["GameID", "GlobalGameID", "GameId"].find((k) => keys.includes(k));
  if (idKey) bits.push(`id=${idKey}`);

  // Image fields, which is what would replace the ESPN/TheSportsDB stitching.
  const imgKeys = keys.filter((k) => /Logo|Photo|Headshot|Image/i.test(k));
  if (imgKeys.length) bits.push(`images: ${imgKeys.slice(0, 3).join(", ")}`);

  // Named sportsbooks, which is what CLV needs — an averaged line is weaker.
  const books = first.PregameOdds ?? first.GameOdds ?? first.Odds;
  if (Array.isArray(books) && books.length) {
    const names = [...new Set(books.map((b) => b.Sportsbook ?? b.SportsbookName).filter(Boolean))];
    bits.push(`books: ${names.length ? names.slice(0, 4).join(", ") : "unnamed"}`);

    // The free tier returns real field names carrying falsified values, which
    // is the one failure mode that looks like success. American odds are
    // undefined between -100 and +100, so a price inside that range is proof
    // the numbers are fake rather than merely unusual.
    const prices = books.flatMap((b) => [b.HomeMoneyLine, b.AwayMoneyLine].filter((n) => typeof n === "number"));
    const fake = prices.filter((n) => Math.abs(n) < 100);
    if (names.includes("Scrambled") || fake.length > prices.length / 2) {
      bits.push("!! VALUES SCRAMBLED — trial tier, not real prices");
    }
  }

  if (keys.includes("Competition") || keys.includes("Name")) {
    const names = json.map((r) => r.Name ?? r.Competition).filter(Boolean);
    if (names.length) bits.push(`e.g. ${names.slice(0, 5).join(", ")}`);
  }

  return bits.join(" · ");
}

console.log(`Probing SportsDataIO for ${today}\n`);

const denied = [];
for (const sport of SPORTS) {
  console.log(`── ${sport.toUpperCase()}`);
  for (const p of probesFor(sport)) {
    const r = await probe(p.path);
    const tag = `${p.feed}/${p.label}`.padEnd(38);
    if (r.status === 200) {
      console.log(`  ok    ${tag} ${summarise(r.json)}`);
    } else if (r.status === 401 || r.status === 403) {
      denied.push(`${sport} ${p.feed}`);
      console.log(`  ---   ${tag} not on this subscription (${r.status})`);
    } else if (r.status === 404) {
      console.log(`  ?     ${tag} no such path (404) — endpoint may have moved`);
    } else {
      console.log(`  FAIL  ${tag} ${r.status}: ${r.text.slice(0, 90)}`);
    }
  }
  console.log();
}

if (denied.length) {
  console.log(`Not included: ${[...new Set(denied)].join(", ")}`);
}
console.log("\nPaste this output back — the Odds rows and the soccer competition list are the ones that decide it.");
