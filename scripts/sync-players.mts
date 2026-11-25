/**
 * Fills the Player table from ESPN, so pick cards can show a player's face.
 *
 *   npx tsx scripts/sync-players.mts            # all leagues with headshots
 *   npx tsx scripts/sync-players.mts NBA NHL    # just these
 *
 * Needs DATABASE_URL pointing at the database you mean to fill. Safe to re-run.
 *
 * This is the command-line way in. The other is GET /api/cron/sync-players,
 * which the "Sync player photos" workflow calls — use that one against
 * production, where the database URL lives in Vercel and not in a shell.
 *
 * Both run the same syncPlayersForSport, deliberately. An earlier version of
 * this script carried its own copy of the fetch-and-normalize logic, which
 * meant the name written to the table and the name the resolver looked up were
 * produced by two functions that had to be kept in step by hand. They would
 * not have stayed in step.
 */
import { PrismaClient } from "@prisma/client";
import { SYNC_LEAGUES, syncPlayersForSport } from "../src/lib/player-sync";
import type { PickSport } from "@prisma/client";

const known = Object.keys(SYNC_LEAGUES);
const requested = process.argv.slice(2).map((s) => s.toUpperCase());
const sports = requested.length ? requested : known;

let failed = 0;
for (const sport of sports) {
  if (!known.includes(sport)) {
    console.error(`${sport}: no ESPN headshots for this league. Known: ${known.join(", ")}`);
    failed = 1;
    continue;
  }

  process.stdout.write(`${sport.padEnd(5)} syncing… `);
  try {
    const r = await syncPlayersForSport(sport as PickSport);
    console.log(
      r.active === 0
        ? `ESPN listed nobody active — left ${r.written} existing row(s) alone`
        : `${r.written} rows, ${r.ambiguous} ambiguous name(s) will show no photo`
    );
  } catch (error) {
    console.error(`failed: ${error instanceof Error ? error.message : error}`);
    failed = 1;
  }
}

await new PrismaClient().$disconnect().catch(() => {});
process.exit(failed);
