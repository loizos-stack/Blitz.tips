import { readdir } from "fs/promises";
import { join } from "path";
import { prisma } from "@/lib/prisma";
import { guardAdminPage } from "@/lib/permissions";
import { telegramConfigured } from "@/lib/telegram";
import { TelegramManager } from "@/components/admin/telegram-manager";
import { getAutopostConfig } from "@/lib/telegram-autopost";
import { alertSettings, ALERT_KINDS } from "@/lib/admin-alerts";
import { AlertSettings } from "@/components/admin/alert-settings";

export const dynamic = "force-dynamic";

export default async function AdminTelegramPage() {
  await guardAdminPage("telegram");

  // Both stills and video, unlike the Meta tool — Telegram takes an mp4 through
  // sendVideo directly, with no upload-then-poll step.
  const assets = await readdir(join(process.cwd(), "public/marketing"))
    .then((files) => files.filter((f) => /\.(png|mp4)$/.test(f)).sort())
    .catch(() => [] as string[]);

  const [autopost, broadcasts, spend, alerts] = await Promise.all([
    getAutopostConfig(),
    prisma.telegramBroadcast.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.adSpendEntry.findMany({ orderBy: { spentOn: "desc" }, take: 50 }),
    alertSettings(),
  ]);

  return (
    <div className="space-y-6">
      <AlertSettings
        kinds={ALERT_KINDS.map((k) => ({
          key: k.key,
          label: k.label,
          description: k.description,
          channels: k.channels,
        }))}
        chatId={alerts.chatId}
        telegramReady={alerts.telegramReady}
        botUsername={alerts.botUsername}
        toggles={alerts.toggles}
        alertEmail={
          process.env.ADMIN_ALERT_EMAIL ?? process.env.CONTACT_EMAIL ?? "support@blitz.tips"
        }
      />
      <TelegramManager
      configured={telegramConfigured()}
      autopost={autopost}
      assets={assets}
      broadcasts={broadcasts.map((b) => ({
        id: b.id,
        chatId: b.chatId,
        chatTitle: b.chatTitle,
        text: b.text,
        asset: b.asset,
        messageId: b.messageId,
        ok: b.ok,
        error: b.error,
        source: b.source,
        sentByEmail: b.sentByEmail,
        createdAt: b.createdAt.toISOString(),
      }))}
      spend={spend.map((s) => ({
        id: s.id,
        platform: s.platform,
        campaign: s.campaign,
        spentOn: s.spentOn.toISOString(),
        spendCents: s.spendCents,
        currency: s.currency,
        impressions: s.impressions,
        clicks: s.clicks,
        notes: s.notes,
      }))}
      />
    </div>
  );
}
