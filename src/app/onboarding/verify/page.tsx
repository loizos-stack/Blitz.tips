import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OnboardingStepper } from "@/components/onboarding/stepper";
import { VerifyCodeForm } from "@/components/verify-code-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verify your email" };

export default async function VerifyStep({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const { as } = await searchParams;
  const isHandicapper = as === "handicapper";

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, emailVerified: true },
  });
  if (!user?.email) redirect("/signin");

  // Handicappers head to their dashboard after verifying; subscribers continue
  // through discover + notifications.
  const nextHref = isHandicapper ? "/dashboard/handicapper" : "/onboarding/discover";
  if (user.emailVerified) redirect(nextHref);

  const steps = isHandicapper
    ? ["Verify email"]
    : ["Verify email", "Discover", "Notifications"];

  return (
    <div className="container-page flex min-h-[calc(100vh-4rem)] items-center justify-center py-16">
      <div className="w-full max-w-sm">
        <OnboardingStepper steps={steps} current={0} />
        <div className="card p-8">
          <h1 className="text-xl font-bold">Verify your email</h1>
          <div className="mt-4">
            <VerifyCodeForm email={user.email} nextHref={nextHref} />
          </div>
        </div>
      </div>
    </div>
  );
}
