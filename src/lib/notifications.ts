import "server-only";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { sendPush } from "@/lib/push";
import { sendTelegram } from "@/lib/telegram";
import { sendDiscordDM } from "@/lib/discord";
import { formatOdds } from "@/lib/odds";
import { siteUrl } from "@/lib/site";
import { emailWrapper, emailLinkPill, escapeHtml } from "@/lib/email-template";
import { unsubscribeUrl, unsubscribePostUrl } from "@/lib/unsubscribe";

// Resolved via siteUrl() so a stale *.vercel.app value in NEXT_PUBLIC_APP_URL
// never leaks into notification links (same rule as emails/Stripe redirects).
const SITE_URL = siteUrl();

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
          html: newPickEmailHtml(handicapper.displayName, body, url, unsubscribeUrl(u.id)),
          listUnsubscribeUrl: unsubscribePostUrl(u.id),
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

function newPickEmailHtml(name: string, body: string, path: string, unsubscribeHref: string): string {
  const href = `${SITE_URL}${path}`;
  return emailWrapper({
    preheader: `${name} posted a new pick — ${body}`,
    unsubscribeUrl: unsubscribeHref,
    bodyHtml: `
      <h1 style="font-size:20px;margin:0 0 12px;color:#13161c;">${escapeHtml(name)} posted a new pick</h1>
      <p style="color:#4b5563;font-size:15px;margin:0 0 24px;">${escapeHtml(body)}</p>
      <p style="margin:0 0 24px;text-align:center;">${emailLinkPill(href, "View the pick")}</p>
      <p style="color:#9ca3af;font-size:12px;margin:0;">You're receiving this because you follow or subscribe to ${escapeHtml(name)} on Blitz.tips. You can turn these off from your notification settings.</p>
    `,
  });
}
