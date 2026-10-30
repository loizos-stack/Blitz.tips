import { NextResponse } from "next/server";

/**
 * The status to return when a third-party API we called rejects or fails.
 *
 * Not 502, which is what this used to be and is what the semantics argue for —
 * "invalid response from an upstream server" describes the situation exactly.
 * The problem is that blitz.tips sits behind Cloudflare, and Cloudflare treats
 * a 502 from the origin as *the origin being broken*: it discards the response
 * and serves its own branded "502 Bad gateway" page instead. The JSON body
 * explaining what actually went wrong never reaches the browser.
 *
 * The symptom is unusually misleading. The client reports
 *
 *   The server errored (502): blitz.tips | 502: Bad gateway …
 *
 * which reads like the application crashed, so you go looking at the deploy and
 * the logs — while the truth is that a provider said no for a reason we were
 * holding all along. It cost a wrong diagnosis once already: a Telegram post
 * that failed with "bot is not a member of the channel chat" showed as a
 * Cloudflare 502 on blitz.tips and as the real message on the *.vercel.app URL,
 * and the difference between the two hosts is precisely this.
 *
 * 400 is a compromise: it is not perfectly accurate — the browser's request was
 * fine, it was the onward call that failed — but it passes through untouched,
 * which is the property that matters. An error nobody can read is worse than an
 * error under a slightly wrong number.
 */
export const UPSTREAM_FAILED_STATUS = 400;

/** A failure from a third-party API, in a form that survives the CDN. */
export function upstreamFailed(message: string) {
  return NextResponse.json({ error: message }, { status: UPSTREAM_FAILED_STATUS });
}
