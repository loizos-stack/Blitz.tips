import "server-only";
import { prisma } from "@/lib/prisma";
import { getConnectedAccount, postTweet } from "@/lib/x-api";
import {
  composeForSlot,
  isSkipped,
  withinLimit,
  autoSendEnabled,
  type XSlot,
} from "@/lib/x-rotation";

/**
 * Queueing and sending the rotation's posts.
 *
 * Kept apart from x-rotation.ts, which only decides what a post should SAY.
 * This is the half that touches the outside world, and the two failure modes
 * it has to avoid are different from each other: composing badly produces a
 * weak post, while sending badly produces two posts, or one nobody approved.
 */

/** Longest a queued post stays sendable. */
const STALE_HOURS = 12;

export interface RunReport {
  slot: XSlot;
  /** What happened, in the words the admin panel shows. */
  outcome: "sent" | "queued" | "skipped" | "failed" | "duplicate";
  detail: string;
  queuedId?: string;
  tweetId?: string;
}

/**
 * Run one slot: compose it, then either send it or leave it for approval.
 *
 * Refuses to run the same slot twice in a day. The Worker fires on a schedule
 * Cloudflare describes as best-effort, and a retried firing must not mean a
 * second identical post — a duplicate on a brand account is the one mistake
 * here that cannot be quietly undone.
 *
 * `autoSend` defaults to the site setting. The admin panel overrides it to
 * false: pressing "compose one now" there should always produce something to
 * read, never a post that is already public by the time the page refreshes.
 */
export async function runSlot(
  slot: XSlot,
  now: Date = new Date(),
  opts: { autoSend?: boolean } = {}
): Promise<RunReport> {
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);

  const already = await prisma.xQueuedPost.findFirst({
    where: { slot, createdAt: { gte: dayStart }, status: { in: ["PENDING", "SENT"] } },
    select: { id: true, status: true },
  });
  if (already) {
    return {
      slot,
      outcome: "duplicate",
      detail: `The ${slot} slot already ran today (${already.status.toLowerCase()}). Nothing sent.`,
    };
  }

  const composed = await composeForSlot(slot, now);
  if (isSkipped(composed)) {
    return { slot, outcome: "skipped", detail: composed.reason };
  }

  if (!withinLimit(composed.text)) {
    return {
      slot,
      outcome: "skipped",
      detail: "Composed post was over X's character limit, so it was not queued.",
    };
  }

  const queued = await prisma.xQueuedPost.create({
    data: {
      slot,
      text: composed.text,
      imageUrl: composed.imageUrl,
      subject: composed.subject,
    },
  });

  const send = opts.autoSend ?? (await autoSendEnabled());
  if (!send) {
    return {
      slot,
      outcome: "queued",
      detail: "Waiting for approval in Admin → X.",
      queuedId: queued.id,
    };
  }

  const sent = await sendQueued(queued.id, { by: null, now });
  return {
    slot,
    outcome: sent.ok ? "sent" : "failed",
    detail: sent.ok ? `Posted as @${sent.username}.` : (sent.error ?? "Posting failed."),
    queuedId: queued.id,
    tweetId: sent.tweetId ?? undefined,
  };
}

export interface SendOutcome {
  ok: boolean;
  tweetId?: string | null;
  username?: string;
  error?: string;
}

/**
 * Send one queued post.
 *
 * The same path serves the automatic sender and the approve button, so the
 * guards below hold either way. The row is claimed by moving it out of PENDING
 * BEFORE the request goes out: if posting then throws, the row is already
 * spoken for and a concurrent run cannot send it a second time. Losing a post
 * to a crash is recoverable; posting it twice is not.
 */
export async function sendQueued(
  id: string,
  opts: { by: string | null; now?: Date } = { by: null }
): Promise<SendOutcome> {
  const now = opts.now ?? new Date();

  const row = await prisma.xQueuedPost.findUnique({ where: { id } });
  if (!row) return { ok: false, error: "That post is no longer in the queue." };
  if (row.status !== "PENDING") {
    return { ok: false, error: `Already ${row.status.toLowerCase()}.` };
  }

  const ageHours = (now.getTime() - row.createdAt.getTime()) / 3_600_000;
  if (ageHours > STALE_HOURS) {
    await prisma.xQueuedPost.update({
      where: { id },
      data: { status: "DISCARDED", decidedAt: now, decidedById: opts.by, error: "Too old to send." },
    });
    return {
      ok: false,
      error: `That post was composed ${Math.round(ageHours)} hours ago and quotes figures that have moved on. It has been discarded rather than sent.`,
    };
  }

  const account = await getConnectedAccount();
  if (!account) {
    return { ok: false, error: "No X account is connected. Connect one in Admin → X." };
  }

  // Claim it first. See the note above: this is what makes a crash mid-send
  // lose a post rather than duplicate one.
  const claimed = await prisma.xQueuedPost.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "SENT", decidedAt: now, decidedById: opts.by },
  });
  if (claimed.count === 0) {
    return { ok: false, error: "Another run took that post first." };
  }

  let media: { bytes: Buffer; mime: string; filename: string } | undefined;
  if (row.imageUrl) {
    media = (await fetchCard(row.imageUrl)) ?? undefined;
  }

  let result: Awaited<ReturnType<typeof postTweet>>;
  try {
    result = await postTweet({ text: row.text, media });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.xQueuedPost.update({
      where: { id },
      data: { status: "FAILED", error: message },
    });
    return { ok: false, error: message };
  }

  const log = await prisma.xPost.create({
    data: {
      username: account.username,
      text: row.text,
      asset: row.imageUrl,
      tweetId: result.tweetId,
      ok: result.ok,
      error: result.error,
      source: `rotation:${row.slot}`,
      sentById: opts.by ?? "cron",
      sentByEmail: opts.by ? "" : "cron",
    },
  });

  await prisma.xQueuedPost.update({
    where: { id },
    data: {
      status: result.ok ? "SENT" : "FAILED",
      xPostId: log.id,
      error: result.error,
    },
  });

  return {
    ok: result.ok,
    tweetId: result.tweetId,
    username: account.username,
    error: result.error ?? undefined,
  };
}

/** Drop a queued post without sending it. */
export async function discardQueued(id: string, by: string): Promise<boolean> {
  const done = await prisma.xQueuedPost.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "DISCARDED", decidedAt: new Date(), decidedById: by },
  });
  return done.count > 0;
}

/**
 * Fetch a generated card to attach.
 *
 * A missing image must never stop a post: the text carries the message and the
 * card only decorates it. Everything here degrades to "post without a picture"
 * rather than throwing, including the timeout — these are our own cached
 * routes, so slow means something is wrong, not that waiting would help.
 */
async function fetchCard(
  url: string
): Promise<{ bytes: Buffer; mime: string; filename: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      console.error(`X rotation: card ${url} returned ${res.status}; posting without it`);
      return null;
    }
    const mime = res.headers.get("content-type") ?? "image/png";
    if (!mime.startsWith("image/")) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    // X rejects an empty part, and anything this large is a bug rather than a
    // card: the generated ones are tens of kilobytes.
    if (bytes.byteLength === 0 || bytes.byteLength > 5_000_000) return null;
    return { bytes, mime, filename: mime.includes("jpeg") ? "card.jpg" : "card.png" };
  } catch (err) {
    console.error(`X rotation: card ${url} failed (${err}); posting without it`);
    return null;
  }
}
