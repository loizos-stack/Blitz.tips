import "server-only";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { sendPush } from "@/lib/push";
import { sendTelegram } from "@/lib/telegram";
import { sendDiscordDM } from "@/lib/discord";
import { formatOdds } from "@/lib/odds";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://blitz.tips";

interface NewPickInput {
  id: string;
  matchup: string;
  selection: string;
  odds: number;
  isPremium: boolean;
  handicapper: { id: string; userId: string; handle: string; displayName: string };
}

/**
 * Fan a freshly posted pick out to the handicapper's audience across every
 * channel: an in-app notification for the bell, plus email and web push for
 * those who haven't opted out. Premium picks are teased (not revealed) to
 * followers who aren't paying subscribers. Best-effort — never throws.
 */
export async function notifyNewPick(pick: NewPickInput): Promise<void> {
  try {
    const { handicapper } = pick;

    const [follows, subs] = await Promise.all([
      prisma.follow.findMany({ where: { handicapperId: handicapper.id }, select: { followerId: true } }),
      prisma.subscription.findMany({
        where: { handicapperId: handicapper.id, status: "ACTIVE" },
        select: { subscriberId: true },
      }),
    ]);

    const subscriberIds = new Set(subs.map((s) => s.subscriberId));
    const recipientIds = new Set<string>([...follows.map((f) => f.followerId), ...subscriberIds]);
    recipientIds.delete(handicapper.userId); // never notify the poster
    if (recipientIds.size === 0) return;

    const users = await prisma.user.findMany({
      where: { id: { in: [...recipientIds] }, suspendedAt: null },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        notifyEmail: true,
        notifyPush: true,
        notifyTelegram: true,
        telegramChatId: true,
        notifyDiscord: true,
        discordUserId: true,
      },
    });

    const url = `/handicappers/${handicapper.handle}`;
    const title = `${handicapper.displayName} posted a new pick`;
    const detail = `${pick.matchup} — ${pick.selection} (${formatOdds(pick.odds)})`;
    const teaser = "New premium pick — subscribe to unlock.";

    const bodyFor = (userId: string) =>
      pick.isPremium && !subscriberIds.has(userId) ? teaser : detail;

    // 1) In-app notifications (the source of truth for the bell).
    await prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        type: "pick.new",
        title,
        body: bodyFor(u.id),
        url,
        handicapperId: handicapper.id,
        pickId: pick.id,
      })),
    });

    // 2) Email — for opted-in, verified recipients.
    const emailTargets = users.filter((u) => u.notifyEmail && u.emailVerified && u.email);
    await Promise.allSettled(
      emailTargets.map((u) => {
        const body = bodyFor(u.id);
        return sendEmail({
          to: u.email,
          subject: title,
          text: newPickEmailText(handicapper.displayName, body, url),
          html: newPickEmailHtml(handicapper.displayName, body, url),
        });
      })
    );

    // 3) Web push — for opted-in recipients with registered subscriptions.
    const pushUserIds = users.filter((u) => u.notifyPush).map((u) => u.id);
    if (pushUserIds.length > 0) {
      const subscriptions = await prisma.pushSubscription.findMany({
        where: { userId: { in: pushUserIds } },
      });
      const results = await Promise.allSettled(
        subscriptions.map(async (s) => {
          const { gone } = await sendPush(
            { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
            { title, body: bodyFor(s.userId), url }
          );
          if (gone) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => null);
        })
      );
      void results;
    }

    // 4) Telegram DMs — for opted-in, linked recipients.
    const chatMessage = (userId: string) => `<b>${escapeHtml(title)}</b>\n${escapeHtml(bodyFor(userId))}\n${SITE_URL}${url}`;
    await Promise.allSettled(
      users
        .filter((u) => u.notifyTelegram && u.telegramChatId)
        .map(async (u) => {
          const { gone } = await sendTelegram(u.telegramChatId!, chatMessage(u.id));
          if (gone) await prisma.user.update({ where: { id: u.id }, data: { telegramChatId: null } }).catch(() => null);
        })
    );

    // 5) Discord DMs — for opted-in, linked recipients.
    const discordMessage = (userId: string) => `**${title}**\n${bodyFor(userId)}\n${SITE_URL}${url}`;
    await Promise.allSettled(
      users
        .filter((u) => u.notifyDiscord && u.discordUserId)
        .map(async (u) => {
          const { gone } = await sendDiscordDM(u.discordUserId!, discordMessage(u.id));
          if (gone) await prisma.user.update({ where: { id: u.id }, data: { discordUserId: null } }).catch(() => null);
        })
    );
  } catch (e) {
    console.error("notifyNewPick failed:", e);
  }
}

function newPickEmailText(name: string, body: string, path: string): string {
  return [
    `${name} just posted a new pick on Blitz.tips.`,
    "",
    body,
    "",
    `View it here: ${SITE_URL}${path}`,
    "",
    "Manage your notification settings from your dashboard.",
  ].join("\n");
}

function newPickEmailHtml(name: string, body: string, path: string): string {
  const href = `${SITE_URL}${path}`;
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#13161c">
    <h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(name)} posted a new pick</h1>
    <p style="color:#4b5563;line-height:1.5;font-size:15px">${escapeHtml(body)}</p>
    <p style="margin:24px 0">
      <a href="${href}" style="background:#16a34a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block">View the pick</a>
    </p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">You're receiving this because you follow or subscribe to ${escapeHtml(name)} on Blitz.tips. You can turn these off from your notification settings.</p>
  </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
