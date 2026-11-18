import { NextResponse } from "next/server";
import { REFERRAL_COOKIE, REFERRAL_COOKIE_MAX_AGE } from "@/lib/referrals";
import { siteUrl } from "@/lib/site";

/**
 * A referral link: blitz.tips/r/ABC1234
 *
 * Drops the code in a cookie and forwards to the signup page. A cookie rather
 * than a query parameter that has to survive the whole journey, because almost
 * nobody signs up on the first page they land on — they read a profile, look at
 * the leaderboard, come back tomorrow. A parameter would be lost at the first
 * click; the cookie is still there when they finally sign up.
 *
 * The code isn't validated here. Whether it resolves to a real account is
 * decided at signup, where getting it wrong costs nothing; failing a redirect
 * because someone mistyped a link would be the worse trade.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const res = NextResponse.redirect(new URL("/signup", siteUrl()));
  res.cookies.set(REFERRAL_COOKIE, code.slice(0, 32).toUpperCase(), {
    maxAge: REFERRAL_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return res;
}
