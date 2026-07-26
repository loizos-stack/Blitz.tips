import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { telegramConfigured } from "@/lib/telegram";
import { discordConfigured } from "@/lib/discord";
import { pushConfigured } from "@/lib/push";
import { NotificationSettings } from "@/components/notification-settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notification settings" };

export default async function NotificationSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/settings/notifications");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      notifyEmail: true,
      notifyPush: true,
      notifyTelegram: true,
      notifyDiscord: true,
      telegramChatId: true,
      discordUserId: true,
    },
  });
  if (!user) redirect("/signin?callbackUrl=/settings/notifications");

  return (
    <div className="container-page max-w-2xl py-12">
      <h1 className="text-3xl font-bold">Notifications</h1>
      <p className="mt-2 text-muted">
        Choose how you want to hear about new picks from handicappers you follow or subscribe to.
      </p>

      <div className="mt-8">
        <NotificationSettings
          initial={{
            email: user.notifyEmail,
            push: user.notifyPush,
            telegram: user.notifyTelegram,
            discord: user.notifyDiscord,
          }}
          telegramLinked={Boolean(user.telegramChatId)}
          discordLinked={Boolean(user.discordUserId)}
          telegramAvailable={telegramConfigured()}
          discordAvailable={discordConfigured()}
          pushAvailable={pushConfigured()}
        />
      </div>
    </div>
  );
}
