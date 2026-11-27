/**
 * Deletes the recap videos from Vercel Blob.
 *
 *   node scripts/purge-recap-videos.mjs                  # dry run, lists only
 *   node scripts/purge-recap-videos.mjs --delete         # actually deletes
 *   node scripts/purge-recap-videos.mjs --delete --prune-rows
 *
 * Needs BLOB_READ_WRITE_TOKEN in the environment. It is a *sensitive*
 * environment variable in Vercel, which means write-only — it cannot be read
 * back from the dashboard or the API, so pull it from wherever you originally
 * stored it, or roll a new one from the Blob store's settings.
 *
 *   BLOB_READ_WRITE_TOKEN=... node scripts/purge-recap-videos.mjs
 *
 * Dry run by default, deliberately. Blob deletion is irreversible and there is
 * no recycle bin, so the default had to be the harmless one — you see the list
 * and the total size, then decide.
 *
 * ## What it touches
 *
 * ONLY the `recaps/` prefix — the daily/filtered recap MP4s written by
 * /api/cron/recap. Everything else in the store (avatars, uploaded media, all
 * of it written through lib/blob.ts) is left alone, which is why this filters
 * by prefix rather than by content type: an "all videos" sweep across the
 * whole store would be one mis-typed extension away from taking the images
 * with it.
 *
 * The marketing videos are NOT here. public/marketing/*.mp4 is committed to
 * git and served from the deployment, so nothing in this script can touch
 * them, and nothing here needs to.
 *
 * ## The rows
 *
 * Each video has a RecapVideo row whose `url` points at the blob. Deleting the
 * blob does not delete the row, and a row pointing at a URL that now 404s is
 * what the admin recaps page will render as a broken entry. --prune-rows
 * deletes the rows for the blobs it deleted, in the same run, so the two
 * cannot drift apart. It needs DATABASE_URL and it only ever removes rows
 * whose URL was actually deleted in this run.
 */
import { list, del } from "@vercel/blob";

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
  console.error(
    "BLOB_READ_WRITE_TOKEN is not set.\n" +
      "It is a sensitive env var in Vercel (write-only — the dashboard will not\n" +
      "show it). Use your own copy, or roll a new token from the Blob store."
  );
  process.exit(1);
}

const doDelete = process.argv.includes("--delete");
const pruneRows = process.argv.includes("--prune-rows");
const PREFIX = "recaps/";

function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Paginate. A store with more blobs than one page returns a cursor, and
// stopping at the first page would silently leave files behind while
// reporting success.
const blobs = [];
let cursor;
do {
  const page = await list({ token, prefix: PREFIX, cursor, limit: 1000 });
  blobs.push(...page.blobs);
  cursor = page.cursor;
} while (cursor);

if (blobs.length === 0) {
  console.log(`Nothing under "${PREFIX}" — nothing to do.`);
  process.exit(0);
}

const total = blobs.reduce((sum, b) => sum + (b.size ?? 0), 0);
blobs.sort((a, b) => a.pathname.localeCompare(b.pathname));

for (const b of blobs) {
  console.log(`  ${b.pathname.padEnd(44)} ${mb(b.size ?? 0).padStart(10)}  ${b.uploadedAt ?? ""}`);
}
console.log(`\n${blobs.length} file(s), ${mb(total)} total.`);

if (!doDelete) {
  console.log("\nDry run — nothing deleted. Re-run with --delete to remove these.");
  process.exit(0);
}

// del() takes up to 1000 URLs per call; chunk so a large store still works.
const urls = blobs.map((b) => b.url);
for (let i = 0; i < urls.length; i += 1000) {
  await del(urls.slice(i, i + 1000), { token });
}
console.log(`\nDeleted ${urls.length} file(s), freeing ${mb(total)}.`);

if (!pruneRows) {
  console.log(
    "\nThe RecapVideo rows still point at these URLs and will now 404 in the\n" +
      "admin recaps page. Re-run with --prune-rows (and DATABASE_URL set) to\n" +
      "remove them too."
  );
  process.exit(0);
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
try {
  // Keyed on the URLs this run actually deleted, not on the prefix, so a row
  // whose blob survived is never removed.
  const { count } = await prisma.recapVideo.deleteMany({ where: { url: { in: urls } } });
  console.log(`Removed ${count} RecapVideo row(s).`);
} finally {
  await prisma.$disconnect();
}
