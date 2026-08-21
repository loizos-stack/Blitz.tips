import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requirePermission } from "@/lib/permissions";
import { authorizeUrl, createPkce, xConfigured } from "@/lib/x-api";

export const dynamic = "force-dynamic";

/**
 * Starts the OAuth handshake that connects an X account to the panel.
 *
 * The state and PKCE verifier go into httpOnly cookies rather than a database
 * row: they are single-use, short-lived, and belong to this browser. Storing
 * them server-side would mean cleaning them up and deciding what happens when
 * two admins start a connect at once — a cookie answers both by construction.
 *
 * Same shape as the Discord connect flow next door, deliberately.
 */
export async function GET(request: Request) {
  const ctx = await requirePermission("x");
  const origin = new URL(request.url).origin;
  if (!ctx) return NextResponse.redirect(`${origin}/admin`);
  if (!xConfigured()) return NextResponse.redirect(`${origin}/admin/x?error=unconfigured`);

  const state = randomBytes(16).toString("hex");
  const { verifier, challenge } = createPkce();
  // Must match a callback URL registered on the X app exactly, including scheme
  // and trailing path — X rejects the handshake on any mismatch.
  const redirectUri = `${origin}/api/admin/x/callback`;

  const res = NextResponse.redirect(authorizeUrl({ redirectUri, state, challenge }));
  const opts = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 600, secure: origin.startsWith("https://") };
  res.cookies.set("x_oauth_state", state, opts);
  res.cookies.set("x_oauth_verifier", verifier, opts);
  return res;
}
