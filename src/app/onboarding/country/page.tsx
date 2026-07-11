import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OnboardingStepper } from "@/components/onboarding/stepper";
import { CountryForm } from "@/components/country-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your country" };

export default async function CountryStep({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const { as } = await searchParams;
  const isHandicapper = as === "handicapper";
  const nextHref = isHandicapper ? "/onboarding/handicapper/profile" : "/onboarding/discover";

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { country: true },
  });
  if (!user) redirect("/signin");
  // Already provided (e.g. credentials signup or returning) — skip ahead.
  if (user.country) redirect(nextHref);

  const steps = isHandicapper
    ? ["Your country"]
    : ["Your country", "Discover", "Notifications"];

  return (
    <div className="container-page flex min-h-[calc(100vh-4rem)] items-center justify-center py-16">
      <div className="w-full max-w-sm">
        <OnboardingStepper steps={steps} current={0} />
        <div className="card p-8">
          <h1 className="text-xl font-bold">Where are you based?</h1>
          <p className="mt-1 text-sm text-muted">This helps us tailor your experience.</p>
          <div className="mt-4">
            <CountryForm initial="" nextHref={nextHref} />
          </div>
        </div>
      </div>
    </div>
  );
}
