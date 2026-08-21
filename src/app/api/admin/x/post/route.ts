import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join, basename } from "path";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";
import { X_MAX_CHARS, getConnectedAccount, postTweet, xConfigured, xLength } from "@/lib/x-api";

export const dynamic = "force-dynamic";
// Uploading an mp4 means streaming megabytes to X inside the request. The
// platform default is nowhere near enough, and a timeout surfaces to the
// browser as a dead connection rather than an error anyone can read.
export const maxDuration = 60;

/**
 * Publish a post to the connected X account.
 *
 * Posting is public and effectively irreversible, so this validates hard before
 * it posts and records every attempt including the failures — a post that
 * didn't land is the row you most want in the history. Same discipline as the
 * Telegram broadcast route.
 */
export async function POST(request: Request) {
  const ctx = await requirePermission("x");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  if (!xConfigured()) {
    return NextResponse.json({ error: "Set X_CLIENT_ID and X_CLIENT_SECRET to post." }, { status: 503 });
  }

  const account = await getConnectedAccount();
  if (!account) {
    return NextResponse.json({ error: "No X account is connected. Connect one first." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Post text is required" }, { status: 400 });

  // Counted the way X counts, so the number here matches the number it enforces.
  if (xLength(text) > X_MAX_CHARS) {
    return NextResponse.json(
      { error: `Post is ${xLength(text)} characters; the limit is ${X_MAX_CHARS}.` },
      { status: 400 }
    );
  }

  // basename() so a path can't climb out of the marketing directory.
  const asset = body.asset ? basename(String(body.asset)) : null;
  if (asset && !/\.(png|jpg|jpeg|mp4)$/i.test(asset)) {
    return NextResponse.json(
      { error: "Attachment must be a .png, .jpg or .mp4 from the marketing set" },
      { status: 400 }
    );
  }

  // Everything past validation is wrapped: an unhandled throw would return a
  // platform error page, and a client parsing that as JSON reports a network
  // failure — which sends you looking in entirely the wrong place.
  try {
    let media: { bytes: Buffer; mime: string } | undefined;
    if (asset) {
      let bytes: Buffer;
      try {
        bytes = await readFile(join(process.cwd(), "public/marketing", asset));
      } catch {
        return NextResponse.json(
          {
            error: `Couldn't read ${asset} on the server. The marketing assets ship with the deployment, so this means the file was renamed or removed since the page listed it — reload and pick again.`,
          },
          { status: 500 }
        );
      }
      const ext = asset.toLowerCase().split(".").pop();
      media = { bytes, mime: ext === "mp4" ? "video/mp4" : ext === "png" ? "image/png" : "image/jpeg" };
    }

    const result = await postTweet({ text, media });

    await prisma.xPost.create({
      data: {
        username: account.username,
        text,
        asset,
        tweetId: result.tweetId,
        ok: result.ok,
        error: result.error,
        sentById: ctx.session.user.id,
        sentByEmail: ctx.session.user.email ?? "",
      },
    });

    await logAdmin(
      ctx.session,
      "x.post",
      "XPost",
      result.tweetId ?? "failed",
      `${result.ok ? "Posted" : "Failed to post"} as @${account.username}${asset ? ` with ${asset}` : ""}`
    );

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });

    return NextResponse.json({
      ok: true,
      tweetId: result.tweetId,
      url: result.tweetId ? `https://x.com/${account.username}/status/${result.tweetId}` : null,
    });
  } catch (e) {
    console.error("X post failed:", e);
    return NextResponse.json({ error: "The post failed on the server. Check the logs." }, { status: 500 });
  }
}
