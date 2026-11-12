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
    select: { email: true, emailVerified: true, username: true, country: true },
  });
  if (!user?.email) redirect("/signin");

  // Always continue via the details step rather than jumping to discover. It
  // sends itself onward the moment nothing is missing, so an email/password
  // signup — which collected both at the form — passes straight through, while
  // a Telegram signup stops there to fill them in. That is what lets one chain
  // serve every entry point instead of each provider hard-coding its own.
  const nextHref = `/onboarding/country?as=${isHandicapper ? "handicapper" : "subscriber"}`;
  if (user.emailVerified) redirect(nextHref);

  // Only advertise the details step to people who will actually see it.
  const needsDetails = !user.username || !user.country;
  const steps = [
    "Verify email",
    ...(needsDetails ? ["Your details"] : []),
    ...(isHandicapper ? [] : ["Discover", "Notifications"]),
  ];

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
