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
  console.info(
    `[affiliate] 1win click sport=${params.get("sport") ?? "-"} event=${params.get("event") ?? "-"}`
  );

  const res = NextResponse.redirect(oneWinUrl(), 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
