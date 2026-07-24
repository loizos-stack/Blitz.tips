import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { telegramConfigured } from "@/lib/telegram";
import { discordConfigured } from "@/lib/discord";
import { pushConfigured } from "@/lib/push";
import { OnboardingStepper } from "@/components/onboarding/stepper";
import { NotificationSettings } from "@/components/notification-settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Set up notifications" };

const STEPS = ["Verify email", "Discover", "Notifications"];

export default async function NotificationsStep() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      emailVerified: true,
      notifyEmail: true,
      notifyPush: true,
      notifyTelegram: true,
      notifyDiscord: true,
      telegramChatId: true,
      discordUserId: true,
    },
  });
  if (!user) redirect("/signin");
  if (!user.emailVerified) redirect("/onboarding/verify?as=subscriber");

  return (
    <div className="container-page flex min-h-[calc(100vh-4rem)] items-start justify-center py-12">
      <div className="w-full max-w-lg">
        <OnboardingStepper steps={STEPS} current={2} />
        <div className="text-center">
          <h1 className="text-2xl font-bold">Stay in the loop</h1>
          <p className="mt-2 text-muted">
            Choose how you want to hear about new picks from handicappers you follow.
          </p>
        </div>

        <div className="mt-6">
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

        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-lg bg-accent px-8 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90"
          >
            Go to my dashboard
          </Link>
          <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
            Skip for now
          </Link>
        </div>
      </div>
    </div>
  );
}
