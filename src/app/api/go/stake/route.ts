import { NextResponse } from "next/server";
import { stakeUrl } from "@/lib/stake";
import { isOutsideUs } from "@/lib/geo";

export const dynamic = "force-dynamic";

/**
 * Outbound affiliate redirect to Stake.com.
 *
 * Everything that leaves for Stake goes through here so the referral code lives
 * in one place and clicks are countable. The geo check is repeated server-side
 * rather than trusted from the UI: the links are only rendered for non-US
 * visitors, but a URL that leaks (shared, crawled, guessed) must not become a
 * way for US traffic to reach an offshore book through us.
 */
export async function GET(request: Request) {
  if (!(await isOutsideUs())) {
    return NextResponse.redirect(new URL("/", request.url), 302);
  }

  const params = new URL(request.url).searchParams;
  const target = stakeUrl(params.get("sport"));

  // Click counting, best-effort — never block or fail the redirect for it.
  console.info(
    `[affiliate] stake click sport=${params.get("sport") ?? "-"} event=${params.get("event") ?? "-"}`
  );

  const res = NextResponse.redirect(target, 302);
  // Affiliate destinations are never worth caching at the edge.
  res.headers.set("Cache-Control", "no-store");
  return res;
}
