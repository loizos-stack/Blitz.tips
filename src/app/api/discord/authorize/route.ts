import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/auth";
import { discordConfigured, discordClientId } from "@/lib/discord";

// Kick off Discord OAuth. We only need the `identify` scope to learn the user's
// Discord id, which the bot then DMs.
export async function GET(request: Request) {
  const session = await auth();
  const origin = new URL(request.url).origin;
  if (!session?.user?.id) return NextResponse.redirect(`${origin}/signin?callbackUrl=/settings/notifications`);
  if (!discordConfigured()) {
    return NextResponse.redirect(`${origin}/settings/notifications?discord=unavailable`);
  }

  const state = randomBytes(16).toString("hex");
  const authUrl = new URL("https://discord.com/api/oauth2/authorize");
  authUrl.searchParams.set("client_id", discordClientId());
  authUrl.searchParams.set("redirect_uri", `${origin}/api/discord/callback`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "identify");
  authUrl.searchParams.set("state", state);

  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set("discord_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
