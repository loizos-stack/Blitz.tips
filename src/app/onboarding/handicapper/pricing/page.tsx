import type { Metadata } from "next";
import Link from "next/link";
import { OnboardingStepper } from "@/components/onboarding/stepper";
import { PricingPackagesCard } from "@/components/pricing-packages-card";
import { requireOnboardingProfile, HANDICAPPER_WIZARD_STEPS } from "@/lib/handicapper-onboarding";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Set your pricing" };

export default async function PricingStep() {
  const profile = await requireOnboardingProfile();

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-2xl">
        <OnboardingStepper steps={HANDICAPPER_WIZARD_STEPS} current={1} />
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">Set your pricing</h1>
          <p className="mt-2 text-muted">Choose your currency, package prices, and an optional free trial.</p>
        </div>
        <PricingPackagesCard
          weeklyPriceCents={profile.weeklyPriceCents}
          monthlyPriceCents={profile.monthlyPriceCents}
          annualPriceCents={profile.annualPriceCents}
          subscriptionTrialDays={profile.subscriptionTrialDays}
          priceCurrency={profile.priceCurrency}
        />
        <div className="mt-8 flex justify-center">
          <Link
            href="/onboarding/handicapper/payments"
            className="rounded-lg bg-accent px-8 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90"
          >
            Continue
          </Link>
        </div>
      </div>
    </div>
  );
}
