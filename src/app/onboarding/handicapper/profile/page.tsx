import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { OnboardingStepper } from "@/components/onboarding/stepper";
import { HandicapperProfileForm } from "@/components/onboarding/handicapper-profile-form";
import { requireVerifiedUser, HANDICAPPER_WIZARD_STEPS } from "@/lib/handicapper-onboarding";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Set up your profile" };

export default async function ProfileStep() {
  const userId = await requireVerifiedUser();
  const profile = await prisma.handicapperProfile.findUnique({ where: { userId } });
  if (profile) redirect("/onboarding/handicapper/pricing");

  return (
    <div className="container-page flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
      <div className="w-full max-w-lg">
        <OnboardingStepper steps={HANDICAPPER_WIZARD_STEPS} current={0} />
        <div className="card p-8">
          <h1 className="text-xl font-bold">Set up your profile</h1>
          <p className="mt-1 text-sm text-muted">
            Every pick you post from here builds your permanent, public track record.
          </p>
          <div className="mt-6">
            <HandicapperProfileForm />
          </div>
        </div>
      </div>
    </div>
  );
}
