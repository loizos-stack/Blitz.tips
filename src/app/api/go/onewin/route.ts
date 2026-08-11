import { NextResponse } from "next/server";
import { oneWinUrl } from "@/lib/onewin";
import { sportsbookForVisitor } from "@/lib/sportsbooks";

export const dynamic = "force-dynamic";

/**
 * Outbound affiliate redirect to 1win.
 *
 * The geo rule is re-checked here rather than trusted from the UI, so a link
 * that was crawled, shared, or bookmarked can't outlive the gate — someone in a
 * market 1win doesn't serve gets sent home instead of to a book that won't take
 * them. Same guarantee the Stake route makes.
 */
export async function GET(request: Request) {
  if ((await sportsbookForVisitor()) !== "onewin") {
    return NextResponse.redirect(new URL("/", request.url), 302);
  }

  const params = new URL(request.url).searchParams;
  const sport = params.get("sport");
  const league = params.get("league");
  console.info(
    `[affiliate] 1win click sport=${sport ?? "-"} league=${league ?? "-"} event=${params.get("event") ?? "-"}`
  );

  // The destination is resolved here, not in the page: an unmapped league
  // quietly falls back to the sport section, so the link in the markup is the
  // same either way and the table can gain entries without a redeploy of
  // anything that renders it.
  const res = NextResponse.redirect(oneWinUrl({ sport, league }), 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
