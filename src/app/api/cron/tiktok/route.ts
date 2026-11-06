import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { fetchStatus, pushVideo, tiktokConfigured } from "@/lib/tiktok";

// Fetching the MP4 back out of Blob storage and pushing it to TikTok is two
// network round trips with a 4MB body in between.
export const maxDuration = 60;

/**
 * Send an already-rendered recap video to the connected TikTok account's
 * drafts.
 *
 * Split from the render pipeline rather than bolted onto it. The renderer runs
 * on a GitHub Actions runner; the TikTok grant lives in this database and is
 * not going anywhere near a CI runner's environment. So the runner says "push
 * the video for this date" and the server, which holds the credentials, does
 * the work.
 *
 * Authorised either by CRON_SECRET (the workflow) or by an admin holding the
 * recaps permission (the button on Admin → Recaps), exactly like the recap
 * route next door.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

/** One day ("2026-10-28") or a winners span ("2026-10-22_2026-10-28"). */
const DATE_KEY = /^\d{4}-\d{2}-\d{2}(_\d{4}-\d{2}-\d{2})?$/;

export async function POST(request: Request) {
  const isAdmin = !authorized(request) && Boolean(await requirePermission("recaps"));
  if (!authorized(request) && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!tiktokConfigured()) {
    return NextResponse.json(
      { error: "TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET are not set." },
      { status: 503 }
    );
  }

  const date = new URL(request.url).searchParams.get("date") ?? "";
  if (!DATE_KEY.test(date)) {
    return NextResponse.json(
      { error: "A ?date=YYYY-MM-DD (or YYYY-MM-DD_YYYY-MM-DD for a winners reel) is required." },
      { status: 400 }
    );
  }

  const video = await prisma.recapVideo.findUnique({ where: { date } });
  if (!video) {
    return NextResponse.json({ error: `No recap video stored for ${date}.` }, { status: 404 });
  }

  // Already pushed and TikTok was happy: don't send it twice. A re-render
  // overwrites the row's figures but leaves these fields, so the guard is
  // explicitly overridable — `?force=1` is how you re-send a corrected video.
  const force = new URL(request.url).searchParams.get("force") === "1";
  if (video.tiktokPublishId && !video.tiktokError && !force) {
    return NextResponse.json({
      ok: true,
      skipped: "already-sent",
      date,
      publishId: video.tiktokPublishId,
      sentAt: video.tiktokSentAt,
    });
  }

  let bytes: Buffer;
  try {
    const res = await fetch(video.url, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    bytes = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    const error = `Could not read the stored video: ${String(e).slice(0, 200)}`;
    await prisma.recapVideo.update({ where: { date }, data: { tiktokError: error } });
    return NextResponse.json({ error }, { status: 502 });
  }

  const pushed = await pushVideo(bytes);

  // The status check is best-effort and intentionally immediate: TikTok
  // processes asynchronously, so this usually reads PROCESSING rather than
  // PUBLISH_COMPLETE. It is here to catch an instant rejection, not to wait
  // for the draft to land — polling for that would hold a serverless function
  // open for no benefit, and the draft arriving is visible in the app anyway.
  const status = pushed.ok && pushed.publishId ? await fetchStatus(pushed.publishId) : null;

  await prisma.recapVideo.update({
    where: { date },
    data: {
      tiktokPublishId: pushed.publishId,
      tiktokStatus: status?.status ?? (pushed.ok ? "SENT" : null),
      tiktokError: pushed.error ?? status?.error ?? null,
      tiktokSentAt: pushed.ok ? new Date() : null,
    },
  });

  if (!pushed.ok) {
    return NextResponse.json({ ok: false, date, error: pushed.error }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    date,
    publishId: pushed.publishId,
    status: status?.status ?? "SENT",
    bytes: bytes.length,
  });
}
