import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { telegramConfigured } from "@/lib/telegram";
import { discordConfigured } from "@/lib/discord";
import { pushConfigured } from "@/lib/push";
import { OnboardingStepper } from "@/components/onboarding/stepper";
import { NotificationSettings } from "@/components/notification-settings";
import { requireOnboardingProfile, HANDICAPPER_WIZARD_STEPS } from "@/lib/handicapper-onboarding";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsStep() {
  await requireOnboardingProfile();
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

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
  if (!user) redirect("/signin");

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-lg">
        <OnboardingStepper steps={HANDICAPPER_WIZARD_STEPS} current={4} />
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="mt-2 text-muted">Choose how you want to hear about activity on your account.</p>
        </div>

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

        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            href="/onboarding/handicapper/plan"
            className="rounded-lg bg-accent px-8 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90"
          >
            Continue
          </Link>
          <Link href="/onboarding/handicapper/plan" className="text-sm text-muted hover:text-foreground">
            Skip for now
          </Link>
        </div>
      </div>
    </div>
  );
}
