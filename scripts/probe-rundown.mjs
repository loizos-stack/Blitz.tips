#!/usr/bin/env node
/**
 * Reports what a Rundown (therundown.io) key actually returns.
 *
 *   RUNDOWN_API_KEY=xxxx node scripts/probe-rundown.mjs
 *   RUNDOWN_API_KEY=xxxx node scripts/probe-rundown.mjs --raw   # dump one event
 *
 * WHY THIS EXISTS. The Blitz Odds adapter in src/lib/blitz-odds-rundown.ts was
 * written from their published shapes without ever seeing a live response —
 * this sandbox cannot reach them. Three things in it are guesses, and all three
 * fail in ways that look like "no games found" rather than like an error:
 *
 *   1. the base URL and which auth header the key wants,
 *   2. the numeric sport ids,
 *   3. the exact field names inside `lines`.
 *
 * This asks the API and prints the answers, so the mapping can be corrected
 * against fact. Reads only — every request is a GET, and the key is never
 * printed.
 */

const KEY = process.env.RUNDOWN_API_KEY?.trim();
if (!KEY) {
  console.error("Set RUNDOWN_API_KEY to your key first.");
  process.exit(1);
}

const RAW = process.argv.includes("--raw");

// Both hosts are tried: the same product is sold through RapidAPI and directly,
// and which one a key belongs to is not visible from the key itself.
const BASES = [
  process.env.RUNDOWN_API_BASE?.trim(),
  "https://therundown-therundown-v1.p.rapidapi.com",
  "https://api.therundown.io/v1",
].filter(Boolean);

function headersFor(base) {
  return {
    "x-rapidapi-key": KEY,
    "x-rapidapi-host": new URL(base).host,
    "X-TheRundown-Key": KEY,
    Accept: "application/json",
  };
}

async function get(base, path) {
  try {
    const res = await fetch(`${base}${path}`, {
      headers: headersFor(base),
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

// --- 1. Which base URL works ------------------------------------------------

let base = null;
console.log("Finding a reachable base URL…\n");
for (const candidate of BASES) {
  const r = await get(candidate, "/sports");
  const ok = r.status === 200 && r.json;
  console.log(`  ${ok ? "ok  " : "no  "} ${candidate}  (${r.status || "unreachable"})`);
  if (ok && !base) base = candidate;
}
if (!base) {
  console.error(
    "\nNone answered. Either the key is for a host not listed above — set RUNDOWN_API_BASE " +
      "to it and re-run — or the key is not valid for this product."
  );
  process.exit(1);
}
console.log(`\nUsing ${base}\n`);

// --- 2. Sport ids -----------------------------------------------------------

const sports = await get(base, "/sports");
const sportList = sports.json?.sports ?? [];
console.log("── Sports (this is the map RUNDOWN_SPORT_IDS needs)");
if (sportList.length === 0) {
  console.log("  (none returned — the response shape may differ; re-run with --raw)");
} else {
  for (const s of sportList) {
    console.log(`  ${String(s.sport_id ?? s.id).padStart(3)}  ${s.sport_name ?? s.name}`);
  }
}
console.log();

// --- 3. A day of events, and what the lines look like ------------------------

const today = new Date().toISOString().slice(0, 10);
// Prefer a sport that plays most days, so the probe is useful whenever it runs.
const preferred = ["MLB", "NBA", "NHL", "NFL", "Soccer"];
const pick =
  sportList.find((s) => preferred.includes(s.sport_name ?? s.name)) ?? sportList[0];

if (!pick) {
  console.error("No sport to sample. Stopping.");
  process.exit(1);
}

const sportId = pick.sport_id ?? pick.id;
console.log(`── Events for ${pick.sport_name ?? pick.name} (id ${sportId}) on ${today}`);

const events = await get(base, `/sports/${sportId}/events/${today}`);
if (events.status !== 200) {
  console.log(`  request failed (${events.status}): ${events.text.slice(0, 200)}`);
  process.exit(1);
}

const list = events.json?.events ?? [];
console.log(`  ${list.length} event(s)`);
if (list.length === 0) {
  console.log("  Nothing scheduled today for this sport — re-run on a match day.");
  process.exit(0);
}

const sample = list[0];
console.log(`  top-level fields: ${Object.keys(sample).join(", ")}`);
console.log(`  event_id: ${sample.event_id ?? "(missing — the adapter needs this)"}`);
console.log(`  event_date: ${sample.event_date ?? "(missing)"}`);

const teams = sample.teams_normalized ?? sample.teams ?? [];
console.log(`  teams: ${teams.map((t) => `${t.name ?? "?"} ${t.mascot ?? ""}`.trim()).join(" v ")}`);

// The books, which is the thing that decides whether the trial is usable.
const lines = sample.lines ?? {};
const affiliates = Object.values(lines).map((l) => l.affiliate?.affiliate_name).filter(Boolean);
console.log(`\n── Books carried on this event (${Object.keys(lines).length})`);
console.log(`  ${affiliates.length ? affiliates.join(", ") : "(no affiliate names found)"}`);

const first = Object.values(lines)[0];
if (first) {
  console.log("\n── Line shape (the field names the adapter maps)");
  for (const section of ["moneyline", "spread", "total"]) {
    const obj = first[section];
    console.log(`  ${section}: ${obj ? Object.keys(obj).join(", ") : "(absent)"}`);
  }
  console.log("\n── Sample values");
  console.log(`  ${JSON.stringify(first.moneyline ?? {})}`);
  console.log(`  ${JSON.stringify(first.spread ?? {})}`);
  console.log(`  ${JSON.stringify(first.total ?? {})}`);
}

if (RAW) {
  console.log("\n── Raw first event\n");
  console.log(JSON.stringify(sample, null, 2).slice(0, 6000));
}

console.log(
  "\nPaste this back. The sports table, the book names and the line field names are " +
    "the three things the adapter is guessing at."
);
