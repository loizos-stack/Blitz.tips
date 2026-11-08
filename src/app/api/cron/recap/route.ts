import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { blobToken } from "@/lib/blob";
import { parseHandles, recapFor, splitRecapKey, winnersFor, yesterday } from "@/lib/recap";
import { requirePermission } from "@/lib/permissions";

export const maxDuration = 60;

/**
 * The two halves of the nightly results-recap video.
 *
 * GET returns the day's settled picks as JSON. POST takes the rendered MP4
 * back and stores it. They are split because neither Vercel's runtime nor the
 * Cloudflare worker can render video — there is no ffmpeg and no browser — so
 * the rendering happens on a GitHub Actions runner, which has both. See
 * .github/workflows/recap-video.yml.
 *
 * The Blob token stays on this side rather than being copied into GitHub
 * secrets: the runner never needs write access to the store, only the ability
 * to hand one file back.
 */

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  const isAdmin = !authorized(request) && (await requirePermission("recaps"));
  if (!authorized(request) && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const plainDate = (v: string | null) => (/^\d{4}-\d{2}-\d{2}$/.test(v ?? "") ? v! : null);

  // ?handicappers=alice,bob narrows the recap to those handicappers. Anything
  // that isn't a valid handle is dropped rather than erroring: a stray comma
  // should not cost someone a render.
  const handles = parseHandles(params.get("handicappers"));

  // Winners mode spans a range: ?mode=winners&from=…&to=… — the promo reel.
  // Without it, one day's honest recap.
  if (params.get("mode") === "winners") {
    const from = plainDate(params.get("from")) ?? plainDate(params.get("date")) ?? yesterday();
    const to = plainDate(params.get("to")) ?? from;
    const payload = await winnersFor(from, to, handles);
    const existing = await prisma.recapVideo.findUnique({ where: { date: payload.date } });
    return NextResponse.json({ ...payload, alreadyRendered: existing?.url ?? null });
  }

  // Only ever a plain date, because it goes into a timestamp range query.
  const date = plainDate(params.get("date")) ?? yesterday();
  const payload = await recapFor(date, handles);
  const existing = await prisma.recapVideo.findUnique({ where: { date: payload.date } });

  return NextResponse.json({ ...payload, alreadyRendered: existing?.url ?? null });
}

/** Max accepted upload. Vercel caps a request body at 4.5MB on this plan. */
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The key the GET handed back, echoed: one day ("2026-10-28") for a recap,
  // a span ("2026-10-28_2026-10-29") for a winners reel, either of them
  // optionally followed by "+handle" for each handicapper it was narrowed to.
  // One video per key, so a re-run overwrites rather than piling up, and a
  // recap of one handicapper's day never lands on top of everyone's.
  const date = new URL(request.url).searchParams.get("date");
  const { period, handles } = splitRecapKey(date ?? "");
  const span = period.match(/^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/);
  const wellFormed =
    (span || /^\d{4}-\d{2}-\d{2}$/.test(period)) && handles.every((h) => /^[a-z0-9_]+$/.test(h));
  if (!date || !wellFormed) {
    return NextResponse.json(
      {
        error:
          "A ?date=YYYY-MM-DD (or YYYY-MM-DD_YYYY-MM-DD for a winners reel), optionally +handle per handicapper, is required.",
      },
      { status: 400 }
    );
  }

  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.length === 0) {
    return NextResponse.json({ error: "Empty body." }, { status: 400 });
  }
  if (bytes.length > MAX_BYTES) {
    return NextResponse.json(
      { error: `Video is ${(bytes.length / 1e6).toFixed(1)}MB; the limit is 4MB.` },
      { status: 413 }
    );
  }
  // Cheap sanity check that this is an MP4 and not whatever else was posted:
  // every ISO-BMFF file carries "ftyp" at offset 4.
  if (bytes.subarray(4, 8).toString("ascii") !== "ftyp") {
    return NextResponse.json({ error: "That isn't an MP4." }, { status: 415 });
  }

  const token = blobToken();
  if (!token) {
    return NextResponse.json(
      { error: "No Blob store is connected, so there is nowhere to put it." },
      { status: 503 }
    );
  }

  // Re-read the figures here rather than trusting the body: the caption that
  // ends up beside this video has to come from the database, not from whatever
  // posted the file.
  const payload = span
    ? await winnersFor(span[1], span[2], handles)
    : await recapFor(period, handles);

  const blob = await put(`recaps/${date}.mp4`, bytes, {
    access: "public",
    contentType: "video/mp4",
    token,
    // One file per day, overwritten on a re-run rather than piling up.
    allowOverwrite: true,
  });

  const row = await prisma.recapVideo.upsert({
    where: { date },
    create: {
      date,
      url: blob.url,
      settled: payload.totals.settled,
      record: payload.totals.record,
      units: payload.totals.units,
    },
    update: {
      url: blob.url,
      settled: payload.totals.settled,
      record: payload.totals.record,
      units: payload.totals.units,
    },
  });

  return NextResponse.json({ ok: true, date, url: row.url, bytes: bytes.length });
}
