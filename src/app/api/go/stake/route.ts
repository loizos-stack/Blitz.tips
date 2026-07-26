import { NextResponse } from "next/server";
import { stakeUrl } from "@/lib/stake";
import { showStakeLinks } from "@/lib/stake-server";

export const dynamic = "force-dynamic";

/**
 * Outbound affiliate redirect to Stake.com.
 *
 * Everything that leaves for Stake goes through here so the referral code lives
 * in one place and clicks are countable. The visibility check is repeated
 * server-side rather than trusted from the UI, so re-enabling the geo gate
 * later closes this route too — a leaked or crawled URL can't outlive it.
 */
export async function GET(request: Request) {
  if (!(await showStakeLinks())) {
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
