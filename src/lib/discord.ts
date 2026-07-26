import "server-only";

// Discord DM notifications are optional: without a bot token + OAuth app the
// channel is hidden and sending is a no-op. Note that Discord only lets a bot
// DM a user who shares a server with it or has DMs open — we surface that
// caveat in the connect UI.
const botToken = process.env.DISCORD_BOT_TOKEN ?? "";
const clientId = process.env.DISCORD_CLIENT_ID ?? "";
const clientSecret = process.env.DISCORD_CLIENT_SECRET ?? "";

const API = "https://discord.com/api/v10";

export function discordConfigured(): boolean {
  return Boolean(botToken && clientId && clientSecret);
}

export function discordClientId(): string {
  return clientId;
}

export function discordClientSecret(): string {
  return clientSecret;
}

/** Send a DM to a Discord user id. `gone: true` when the DM can't be delivered. */
export async function sendDiscordDM(userId: string, content: string): Promise<{ gone: boolean }> {
  if (!botToken) return { gone: false };
  try {
    const chRes = await fetch(`${API}/users/@me/channels`, {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ recipient_id: userId }),
    });
    if (!chRes.ok) return { gone: chRes.status === 403 || chRes.status === 404 };
    const channel = (await chRes.json()) as { id: string };
    const msgRes = await fetch(`${API}/channels/${channel.id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    return { gone: msgRes.status === 403 };
  } catch {
    return { gone: false };
  }
}
