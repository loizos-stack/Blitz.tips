import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";
import { exchangeCode, getMe, saveAccount, xConfigured } from "@/lib/x-api";

export const dynamic = "force-dynamic";

/**
 * X sends the authorization code back here.
 *
 * Every failure ends on /admin/x with a readable reason rather than a stack
 * trace: this page is reached by a redirect from another site, so an exception
 * here surfaces as a blank error page with no way back.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const back = (error?: string) => NextResponse.redirect(`${origin}/admin/x${error ? `?error=${encodeURIComponent(error)}` : "?connected=1"}`);

  const ctx = await requirePermission("x");
  if (!ctx) return NextResponse.redirect(`${origin}/admin`);
  if (!xConfigured()) return back("unconfigured");

  const url = new URL(request.url);
  // X reports a user who pressed Cancel this way rather than as an error.
  const denied = url.searchParams.get("error");
  if (denied) return back(`X returned "${denied}"`);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const expectedState = jar.get("x_oauth_state")?.value;
  const verifier = jar.get("x_oauth_verifier")?.value;

  // The state check is what stops someone handing an admin a crafted callback
  // that connects *their* X account to your panel.
  if (!code || !state || !expectedState || state !== expectedState || !verifier) {
    return back("That connection attempt didn't match — start again from Admin → X.");
  }

  let res: NextResponse;
  try {
    const token = await exchangeCode({ code, verifier, redirectUri: `${origin}/api/admin/x/callback` });
    const me = await getMe(token.access_token);
    if (!me) {
      res = back("Connected, but X wouldn't say which account. Check the users.read scope and try again.");
    } else {
      await saveAccount({
        xUserId: me.id,
        username: me.username,
        name: me.name,
        token,
        connectedBy: ctx.session.user.id,
      });
      await logAdmin(ctx.session, "x.connect", "XAccount", me.id, `Connected @${me.username}`);
      res = back();
    }
  } catch (e) {
    res = back(`Could not complete the connection: ${String(e).slice(0, 200)}`);
  }

  // Single-use either way — leaving them lets a stale verifier be replayed.
  res.cookies.delete("x_oauth_state");
  res.cookies.delete("x_oauth_verifier");
  return res;
}
