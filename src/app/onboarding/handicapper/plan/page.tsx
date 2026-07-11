import type { Metadata } from "next";
import { OnboardingStepper } from "@/components/onboarding/stepper";
import { HandicapperPlanStep } from "@/components/onboarding/handicapper-plan-step";
import { requireOnboardingProfile, HANDICAPPER_WIZARD_STEPS } from "@/lib/handicapper-onboarding";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Choose your plan" };

export default async function PlanStep() {
  const profile = await requireOnboardingProfile();

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-3xl">
        <OnboardingStepper steps={HANDICAPPER_WIZARD_STEPS} current={5} />
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">Choose your plan</h1>
          <p className="mt-2 text-muted">
            Free to start — upgrade to Silver or Gold anytime for a lower commission and more reach.
          </p>
        </div>
        <HandicapperPlanStep currentPlan={profile.plan} />
      </div>
    </div>
  );
}
