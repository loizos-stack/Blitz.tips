import "server-only";
import { prisma } from "@/lib/prisma";
import { broadcastText, telegramConfigured } from "@/lib/telegram";
import { sendPush, pushConfigured } from "@/lib/push";
import { formatMove } from "@/lib/blitz-odds";
import type { WatchSettings } from "@/lib/blitz-odds-poll";
import type { OddsDrop } from "@prisma/client";

/**
 * Delivering a Blitz Odds alert.
 *
 * Split from the poller so a Telegram outage cannot lose a detection: the drop
 * is committed first, and this marks `notifiedAt` only for what actually went
 * out. An undelivered alert stays visible in the panel with nothing sent
 * against it, which is the state you want to be able to see.
 */

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
/** Telegram parses HTML, so anything from the feed has to be escaped. */
function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ESC[c]);
}

function pointLabel(point: number | null): string {
  if (point === null) return "";
  return ` ${point > 0 ? "+" : ""}${point}`;
}

/** One-line summary used as the notification title. */
export function dropTitle(drop: OddsDrop): string {
  return `${drop.selection}${pointLabel(drop.point)} — ${drop.marketLabel}`;
}

export function dropBody(drop: OddsDrop): string {
  return (
    `${drop.matchup} · ${formatMove(drop.openPrice, drop.currentPrice)} ` +
    `(+${drop.probDelta.toFixed(1)} pts) at ${drop.bookCount} books · ` +
    `${drop.baselineMinutes} → ${drop.minutesToStart} min before start`
  );
}

function telegramMessage(drop: OddsDrop): string {
  return [
    `⚡ <b>${esc(drop.selection)}${esc(pointLabel(drop.point))}</b>`,
    `${esc(drop.marketLabel)} — ${esc(drop.matchup)}`,
    ``,
    `${esc(formatMove(drop.openPrice, drop.currentPrice))}  (+${drop.probDelta.toFixed(1)} probability points)`,
    `Moved at <b>${drop.bookCount}</b> books: ${esc(drop.books)}`,
    ``,
    // The windows actually sampled, not the ones configured — a late poll
    // compares 34 minutes to 6, and saying so keeps the claim checkable.
    `Compared ${drop.baselineMinutes} min out against ${drop.minutesToStart} min out`,
    `⏱ Kickoff in ${drop.minutesToStart} min`,
  ].join("\n");
}

/**
 * The private Telegram destination.
 *
 * Read from settings first, environment second, and never from the broadcast
 * channel setting. Blitz Odds is a private tool; sharing a chat id with the
 * subscriber broadcast would be one mis-click away from publishing every line
 * move to the whole channel.
 */
export function alertChatId(settings: WatchSettings): string | null {
  const configured = settings.telegramChatId.trim() || process.env.TELEGRAM_ALERT_CHAT_ID?.trim();
  return configured || null;
}

/**
 * Who may receive an on-site or push alert.
 *
 * Mirrors getAdminContext's rule rather than inventing a second one: superadmin
 * by flag OR by bootstrap email, plus scoped admins holding the `odds` key.
 * Suspended accounts are excluded — a suspended admin should stop receiving a
 * private feed at the moment they are suspended, not whenever someone
 * remembers.
 */
export async function alertRecipients(): Promise<{ id: string }[]> {
  const bootstrapEmails = [
    ...(process.env.ADMIN_EMAILS ?? "").split(","),
    ...(process.env.SUPERADMIN_EMAILS ?? "").split(","),
  ]
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return prisma.user.findMany({
    where: {
      suspendedAt: null,
      OR: [
        { isSuperAdmin: true },
        ...(bootstrapEmails.length ? [{ email: { in: bootstrapEmails } }] : []),
        { role: "ADMIN", adminPermissions: { has: "odds" } },
      ],
    },
    select: { id: true },
  });
}

export interface NotifyResult {
  onSite: number;
  push: number;
  telegram: number;
  errors: string[];
}

/**
 * Deliver a batch of drops, then mark them notified.
 *
 * Alerts go only to admins holding the `odds` permission — this is a private
 * tool, and the on-site notification table is otherwise shown to ordinary
 * users, so the recipient list is derived from permissions rather than from
 * anything the drop itself carries.
 */
export async function notifyDrops(drops: OddsDrop[], settings: WatchSettings): Promise<NotifyResult> {
  const result: NotifyResult = { onSite: 0, push: 0, telegram: 0, errors: [] };
  if (drops.length === 0) return result;

  const recipients =
    settings.notifyOnSite || settings.notifyPush ? await alertRecipients() : [];

  for (const drop of drops) {
    if (settings.notifyOnSite && recipients.length > 0) {
      await prisma.notification.createMany({
        data: recipients.map((u) => ({
          userId: u.id,
          type: "odds.drop",
          title: dropTitle(drop),
          body: dropBody(drop),
          url: "/admin/blitz-odds",
        })),
      });
      result.onSite += recipients.length;
    }

    if (settings.notifyPush && pushConfigured() && recipients.length > 0) {
      const subs = await prisma.pushSubscription.findMany({
        where: { userId: { in: recipients.map((u) => u.id) } },
      });
      for (const sub of subs) {
        const { gone } = await sendPush(sub, {
          title: `⚡ ${dropTitle(drop)}`,
          body: dropBody(drop),
          url: "/admin/blitz-odds",
        });
        if (gone) await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        else result.push += 1;
      }
    }

    if (settings.notifyTelegram) {
      const chatId = alertChatId(settings);
      if (!chatId) {
        result.errors.push("Telegram alerts are on but no private chat id is set.");
      } else if (!telegramConfigured()) {
        result.errors.push("Telegram alerts are on but TELEGRAM_BOT_TOKEN is not set.");
      } else {
        const sent = await broadcastText(chatId, telegramMessage(drop));
        if (sent.ok) result.telegram += 1;
        else result.errors.push(sent.error ?? "Telegram rejected the alert");
      }
    }
  }

  await prisma.oddsDrop.updateMany({
    where: { id: { in: drops.map((d) => d.id) } },
    data: { notifiedAt: new Date() },
  });

  // Duplicate errors are collapsed: a misconfigured chat id would otherwise
  // repeat identically for every drop in the batch and bury anything else.
  result.errors = [...new Set(result.errors)];
  return result;
}

/** Drops detected but not yet delivered, oldest first. */
export async function pendingDrops(limit = 50): Promise<OddsDrop[]> {
  return prisma.oddsDrop.findMany({
    where: { notifiedAt: null },
    orderBy: { detectedAt: "asc" },
    take: limit,
  });
}
