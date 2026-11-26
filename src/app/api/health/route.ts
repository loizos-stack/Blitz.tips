import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * The first line of an error that actually says something.
 *
 * Prisma formats a failure as "Invalid `prisma.x()` invocation:", two blank
 * lines, then the real cause. Taking line zero gets a blank; taking the whole
 * message puts a stack-shaped blob in an alert. This walks to the first line
 * with content and skips the invocation preamble when there is something
 * after it.
 */
function firstMeaningfulLine(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const cause = lines.find((line) => !line.startsWith("Invalid `") && !line.endsWith("invocation:"));
  return cause ?? lines[0] ?? "unknown error";
}

/**
 * Is the site actually serving, and can it reach its database?
 *
 * Added after the 2026-11-26 outage, which lasted four hours and was noticed
 * because a person opened the site and saw an error. Nothing watched. The
 * Vercel compute allowance had already run out once on 18 November the same
 * way — silently.
 *
 * Deliberately touches the database, because that is what broke. A check that
 * only proves Next.js is answering would have returned a cheerful 200
 * throughout the outage: the deployment was healthy the whole time and the
 * pages were served from cache. `SELECT 1` is the cheapest query that
 * distinguishes those two states.
 *
 * AUTHENTICATED, which is unusual for a health endpoint and is the point. Any
 * request that reaches the database wakes Neon's compute and keeps it awake
 * for its idle timeout. An open endpoint is therefore a way for anyone to burn
 * the monthly CU-hour allowance — precisely the failure this is here to catch.
 * CRON_SECRET, the same bearer token auto-settle and the player sync use.
 *
 * On the cost of monitoring itself: one call wakes the compute for about five
 * minutes. Hourly, that is roughly two and a half hours of compute a day, or
 * about 18 CU-hours a month against an allowance of 300 — six percent, to find
 * out within the hour rather than when a customer complains. Running it every
 * five minutes would cost the allowance outright, which is why the schedule in
 * the workflow is hourly and should stay that way.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    // 503 rather than 500: this is a dependency being unavailable, and the
    // checker distinguishes "the app is broken" from "the app cannot reach
    // Postgres" by the status alone.
    return NextResponse.json(
      {
        ok: false,
        db: "unreachable",
        ms: Date.now() - startedAt,
        // The first NON-EMPTY line. Prisma's messages open with a blank line
        // and then a blank-separated preamble, so splitting on the first
        // newline returns an empty string — which is what this field did until
        // a down-database test showed `detail: ""` where the diagnosis should
        // be. The useful line is "Can't reach database server at <host>".
        detail: firstMeaningfulLine(error),
      },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true, db: "reachable", ms: Date.now() - startedAt });
}
