import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requirePermission } from "@/lib/permissions";
import { authorizeUrl, createPkce, tiktokConfigured } from "@/lib/tiktok";

export const dynamic = "force-dynamic";

/**
 * Starts the OAuth handshake that connects a TikTok account to the panel.
 *
 * Same shape as the X connect flow next door, deliberately: state and PKCE
 * verifier in httpOnly cookies rather than database rows, because they are
 * single-use, short-lived, and belong to this browser.
 */
export async function GET(request: Request) {
  const ctx = await requirePermission("recaps");
  const origin = new URL(request.url).origin;
  if (!ctx) return NextResponse.redirect(`${origin}/admin`);
  if (!tiktokConfigured()) return NextResponse.redirect(`${origin}/admin/recaps?error=unconfigured`);

  const state = randomBytes(16).toString("hex");
  const { verifier, challenge } = createPkce();
  // Must match a redirect URI registered on the TikTok app exactly, including
  // scheme and trailing path — TikTok rejects the handshake on any mismatch.
  const redirectUri = `${origin}/api/admin/tiktok/callback`;

  const res = NextResponse.redirect(authorizeUrl({ redirectUri, state, challenge }));
  const opts = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
    secure: origin.startsWith("https://"),
  };
  res.cookies.set("tiktok_oauth_state", state, opts);
  res.cookies.set("tiktok_oauth_verifier", verifier, opts);
  return res;
}
