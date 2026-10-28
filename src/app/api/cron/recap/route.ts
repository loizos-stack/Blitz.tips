import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { blobToken } from "@/lib/blob";
import { recapFor, yesterday } from "@/lib/recap";
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

  const asked = new URL(request.url).searchParams.get("date");
  // Only ever a plain date, because it goes into a timestamp range query.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(asked ?? "") ? asked! : yesterday();

  const payload = await recapFor(date);
  const existing = await prisma.recapVideo.findUnique({ where: { date } });

  return NextResponse.json({ ...payload, alreadyRendered: existing?.url ?? null });
}

/** Max accepted upload. Vercel caps a request body at 4.5MB on this plan. */
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = new URL(request.url).searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "A ?date=YYYY-MM-DD is required." }, { status: 400 });
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
  const payload = await recapFor(date);

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
