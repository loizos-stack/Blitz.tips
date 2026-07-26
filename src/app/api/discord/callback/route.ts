import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { discordConfigured, discordClientId, discordClientSecret } from "@/lib/discord";

// Discord redirects back here with a code. Exchange it, read the user's id, and
// store it so the bot can DM them.
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const settings = `${origin}/settings/notifications`;

  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(`${origin}/signin?callbackUrl=/settings/notifications`);
  if (!discordConfigured()) return NextResponse.redirect(`${settings}?discord=unavailable`);

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = (await cookies()).get("discord_oauth_state")?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(`${settings}?discord=error`);
  }

  try {
    const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: discordClientId(),
        client_secret: discordClientSecret(),
        grant_type: "authorization_code",
        code,
        redirect_uri: `${origin}/api/discord/callback`,
      }),
    });
    if (!tokenRes.ok) return NextResponse.redirect(`${settings}?discord=error`);
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenJson.access_token) return NextResponse.redirect(`${settings}?discord=error`);

    const meRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    if (!meRes.ok) return NextResponse.redirect(`${settings}?discord=error`);
    const me = (await meRes.json()) as { id?: string };
    if (!me.id) return NextResponse.redirect(`${settings}?discord=error`);

    await prisma.user.update({ where: { id: session.user.id }, data: { discordUserId: me.id } });
  } catch {
    return NextResponse.redirect(`${settings}?discord=error`);
  }

  const res = NextResponse.redirect(`${settings}?discord=connected`);
  res.cookies.delete("discord_oauth_state");
  return res;
}
