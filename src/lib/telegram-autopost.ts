import "server-only";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/site";
import { getSetting } from "@/lib/settings";
import { formatOdds } from "@/lib/odds";
import { escapeHtml } from "@/lib/email-template";
import { broadcastText, telegramConfigured } from "@/lib/telegram";

/**
 * Announce a newly posted **free** tip to the public Telegram channel.
 *
 * The entire point of this file is the word "free". A premium pick is the
 * product a subscriber paid for; posting it to a public channel would give it
 * away to everyone and make the subscription worthless. That check therefore
 * lives here, in the function that does the posting — not only at the call
 * site — so a future caller can't reintroduce the leak by forgetting it.
 *
 * Best-effort in every direction: it never throws, and a Telegram failure must
 * not affect the pick that was just created. Each attempt is recorded in
 * TelegramBroadcast with source="free-pick", so failures are visible in the
 * admin history rather than lost to a log nobody reads.
 */

/** SiteSetting keys, editable from Admin → Telegram without a redeploy. */
export const AUTOPOST_CHANNEL_KEY = "telegram.autopost.channel";
export const AUTOPOST_ENABLED_KEY = "telegram.autopost.enabled";

export interface AutopostConfig {
  enabled: boolean;
  channel: string | null;
}

export async function getAutopostConfig(): Promise<AutopostConfig> {
  const [enabled, channel] = await Promise.all([
    getSetting(AUTOPOST_ENABLED_KEY),
    getSetting(AUTOPOST_CHANNEL_KEY),
  ]);
  return { enabled: enabled === "1", channel: channel?.trim() || null };
}

export interface FreePickAnnouncement {
  id: string;
  matchup: string;
  selection: string;
  odds: number;
  isPremium: boolean;
  handicapper: { userId: string; handle: string; displayName: string };
}

export async function announceFreePick(pick: FreePickAnnouncement): Promise<void> {
  try {
    // The guard that matters. Never post paid content publicly.
    if (pick.isPremium) return;

    if (!telegramConfigured()) return;
    const { enabled, channel } = await getAutopostConfig();
    if (!enabled || !channel) return;

    const profileUrl = `${siteUrl()}/handicappers/${pick.handicapper.handle}`;

    // HTML parse mode, so every interpolated value is escaped — a team name
    // with an ampersand in it would otherwise make Telegram reject the message.
    const text = [
      `🆓 <b>New free tip</b> from ${escapeHtml(pick.handicapper.displayName)}`,
      "",
      escapeHtml(pick.matchup),
      `<b>${escapeHtml(pick.selection)}</b> @ ${escapeHtml(formatOdds(pick.odds))}`,
      "",
      `<a href="${profileUrl}">Full record and every pick →</a>`,
    ].join("\n");

    const result = await broadcastText(channel, text);

    await prisma.telegramBroadcast
      .create({
        data: {
          chatId: channel,
          chatTitle: null,
          text,
          asset: null,
          messageId: result.messageId,
          ok: result.ok,
          error: result.error,
          source: "free-pick",
          // Attributed to the handicapper who triggered it, so the history
          // answers "who caused this post" rather than naming a system user.
          sentById: pick.handicapper.userId,
          sentByEmail: `@${pick.handicapper.handle}`,
        },
      })
      .catch(() => null);
  } catch (e) {
    console.error("announceFreePick failed:", e);
  }
}
