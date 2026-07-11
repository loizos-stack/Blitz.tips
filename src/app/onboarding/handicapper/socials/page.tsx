import type { Metadata } from "next";
import Link from "next/link";
import { OnboardingStepper } from "@/components/onboarding/stepper";
import { SocialsForm } from "@/components/socials-form";
import { requireOnboardingProfile, HANDICAPPER_WIZARD_STEPS } from "@/lib/handicapper-onboarding";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your socials" };

export default async function SocialsStep() {
  const profile = await requireOnboardingProfile();

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-2xl">
        <OnboardingStepper steps={HANDICAPPER_WIZARD_STEPS} current={3} />
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">Add your socials</h1>
          <p className="mt-2 text-muted">Link your channels so followers can find you. All optional.</p>
        </div>

        <SocialsForm
          initial={{
            xUrl: profile.xUrl,
            instagramUrl: profile.instagramUrl,
            youtubeUrl: profile.youtubeUrl,
            tiktokUrl: profile.tiktokUrl,
            discordUrl: profile.discordUrl,
            telegramUrl: profile.telegramUrl,
            websiteUrl: profile.websiteUrl,
          }}
        />

        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            href="/onboarding/handicapper/notifications"
            className="rounded-lg bg-accent px-8 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90"
          >
            Continue
          </Link>
          <Link href="/onboarding/handicapper/notifications" className="text-sm text-muted hover:text-foreground">
            Skip for now
          </Link>
        </div>
      </div>
    </div>
  );
}
