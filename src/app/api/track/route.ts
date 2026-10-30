import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientMeta } from "@/lib/request-meta";
import { rateLimit } from "@/lib/rate-limit";
import {
  deviceFrom,
  isTrackablePath,
  looksLikeBot,
  normalizePath,
  referrerHost,
  visitorDigest,
} from "@/lib/traffic";

export const dynamic = "force-dynamic";

/**
 * Record one page view.
 *
 * Called by the beacon in components/page-view-tracker.tsx. Always answers 204
 * — there is nothing for the page to do with a failure, and an analytics
 * endpoint returning errors into a visitor's console is noise about a thing
 * they did not ask for and cannot fix.
 *
 * Everything identifying is dropped here rather than in the client, because
 * the client is not the boundary: this route is reachable directly with any
 * body, so the query string is stripped, the referrer reduced to a host and
 * the IP turned into a daily digest on this side of the wire.
 */
export async function POST(request: Request) {
  const { ip, userAgent } = clientMeta(request);
  const ua = userAgent ?? "";

  // Bots first, before spending anything else on them.
  if (looksLikeBot(ua)) return new NextResponse(null, { status: 204 });

  // One browser cannot generate hundreds of views a minute by hand. This is
  // what stops someone with the endpoint URL writing whatever they like into
  // the figures.
  const limit = await rateLimit(`track:${ip ?? "anon"}`, 120, 60);
  if (!limit.ok) return new NextResponse(null, { status: 204 });

  const body = (await request.json().catch(() => null)) as
    | { path?: unknown; referrer?: unknown }
    | null;
  if (!body) return new NextResponse(null, { status: 204 });

  const path = typeof body.path === "string" ? normalizePath(body.path) : null;
  if (!path || !isTrackablePath(path)) return new NextResponse(null, { status: 204 });

  const host = new URL(request.url).hostname;
  const referrer = referrerHost(typeof body.referrer === "string" ? body.referrer : null, host);

  // Set by the edge; absent when running locally, which is simply unknown
  // rather than a reason to refuse the row.
  const country = request.headers.get("x-vercel-ip-country")?.slice(0, 2).toUpperCase() || null;

  await prisma.pageView
    .create({
      data: {
        path,
        referrer,
        country,
        device: deviceFrom(ua),
        visitorHash: visitorDigest(ip ?? "", ua),
      },
    })
    // A lost page view is a lost page view. It is not worth telling anyone
    // about, and certainly not worth failing a request over.
    .catch((e) => console.error("[track] write failed:", e));

  return new NextResponse(null, { status: 204 });
}
