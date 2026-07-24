import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OnboardingStepper } from "@/components/onboarding/stepper";
import { HandicapperCard } from "@/components/handicapper-card";
import { listHottestHandicappers } from "@/lib/handicappers";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Discover handicappers" };

const STEPS = ["Verify email", "Discover", "Notifications"];

export default async function DiscoverStep() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailVerified: true },
  });
  if (!user) redirect("/signin");
  // Must verify first.
  if (!user.emailVerified) redirect("/onboarding/verify?as=subscriber");

  const hot = await listHottestHandicappers({ days: 7, limit: 6 });

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-5xl">
        <OnboardingStepper steps={STEPS} current={1} />
        <div className="text-center">
          <h1 className="text-2xl font-bold">This week&apos;s hottest handicappers</h1>
          <p className="mt-2 text-muted">
            Ranked by ROI over the last 7 days. Follow to get their picks in your feed, or open a profile to
            subscribe to premium tips.
          </p>
        </div>

        {hot.length === 0 ? (
          <p className="mt-10 text-center text-muted">
            No standout handicappers this week yet — you can explore the full leaderboard anytime.
          </p>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {hot.map((h) => (
              <HandicapperCard key={h.id} handicapper={h} />
            ))}
          </div>
        )}

        <div className="mt-10 flex flex-col items-center gap-3">
          <Link
            href="/onboarding/notifications"
            className="rounded-lg bg-accent px-8 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90"
          >
            Continue
          </Link>
          <Link href="/onboarding/notifications" className="text-sm text-muted hover:text-foreground">
            Skip for now
          </Link>
        </div>
      </div>
    </div>
  );
}
