import type { Metadata } from "next";
import Link from "next/link";
import { OnboardingStepper } from "@/components/onboarding/stepper";
import { ConnectOnboardingBanner, StripePayoutsCard } from "@/components/connect-onboarding-banner";
import { PayoutWalletsCard } from "@/components/payout-wallets-card";
import { connectBannerState } from "@/lib/connect";
import { requireOnboardingProfile, HANDICAPPER_WIZARD_STEPS } from "@/lib/handicapper-onboarding";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Set up payments" };

export default async function PaymentsStep() {
  const profile = await requireOnboardingProfile();
  // Same state the dashboard's payouts section uses, so the country the picker
  // starts on is the same wherever the handicapper happens to click Connect.
  const connect = await connectBannerState(profile);

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-2xl">
        <OnboardingStepper steps={HANDICAPPER_WIZARD_STEPS} current={2} />
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">Get paid</h1>
          <p className="mt-2 text-muted">
            Connect Stripe to accept card subscriptions, and add crypto payout wallets so we can send your
            cut of crypto subscriptions. Both are optional — you can finish these anytime from your dashboard.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {connect.ready ? (
            <StripePayoutsCard />
          ) : (
            <ConnectOnboardingBanner
              resume={connect.resume}
              defaultCountry={connect.defaultCountry}
              unsupportedCountry={connect.unsupportedCountry}
            />
          )}
          <PayoutWalletsCard
            payoutEthAddress={profile.payoutEthAddress}
            payoutBtcAddress={profile.payoutBtcAddress}
          />
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            href="/onboarding/handicapper/socials"
            className="rounded-lg bg-accent px-8 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90"
          >
            Continue
          </Link>
          <Link href="/onboarding/handicapper/socials" className="text-sm text-muted hover:text-foreground">
            Skip for now
          </Link>
        </div>
      </div>
    </div>
  );
}
