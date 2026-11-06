import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";
import { exchangeCode, getCreatorName, saveAccount, tiktokConfigured } from "@/lib/tiktok";

export const dynamic = "force-dynamic";

/**
 * TikTok sends the authorization code back here.
 *
 * Every failure ends on /admin/recaps with a readable reason rather than a
 * stack trace: this page is reached by a redirect from another site, so an
 * exception here surfaces as a blank error page with no way back.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const back = (error?: string) =>
    NextResponse.redirect(
      `${origin}/admin/recaps${error ? `?error=${encodeURIComponent(error)}` : "?connected=tiktok"}`
    );

  const ctx = await requirePermission("recaps");
  if (!ctx) return NextResponse.redirect(`${origin}/admin`);
  if (!tiktokConfigured()) return back("unconfigured");

  const url = new URL(request.url);
  // TikTok reports a creator who pressed Cancel this way rather than as an error.
  const denied = url.searchParams.get("error");
  if (denied) {
    return back(`TikTok returned "${denied}": ${url.searchParams.get("error_description") ?? ""}`.trim());
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const expectedState = jar.get("tiktok_oauth_state")?.value;
  const verifier = jar.get("tiktok_oauth_verifier")?.value;

  // The state check is what stops someone handing an admin a crafted callback
  // that connects *their* TikTok account to your panel.
  if (!code || !state || !expectedState || state !== expectedState || !verifier) {
    return back("That connection attempt didn't match — start again from Admin → Recaps.");
  }

  let res: NextResponse;
  try {
    const token = await exchangeCode({
      code,
      verifier,
      redirectUri: `${origin}/api/admin/tiktok/callback`,
    });
    // The display name is a nicety; open_id comes back on the token response
    // itself, so a failure here still leaves a usable connection.
    const me = await getCreatorName(token.access_token);
    const openId = me?.openId ?? token.open_id ?? null;
    if (!openId) {
      res = back("Connected, but TikTok wouldn't say which account. Try again.");
    } else {
      await saveAccount({
        openId,
        displayName: me?.displayName ?? null,
        token,
        connectedBy: ctx.session.user.id,
      });
      await logAdmin(
        ctx.session,
        "tiktok.connect",
        "TikTokAccount",
        openId,
        `Connected ${me?.displayName ?? openId}`
      );
      res = back();
    }
  } catch (e) {
    res = back(`Could not complete the connection: ${String(e).slice(0, 200)}`);
  }

  // Single-use either way — leaving them lets a stale verifier be replayed.
  res.cookies.delete("tiktok_oauth_state");
  res.cookies.delete("tiktok_oauth_verifier");
  return res;
}
