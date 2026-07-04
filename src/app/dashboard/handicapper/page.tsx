import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeStats } from "@/lib/odds";
import { formatCents } from "@/lib/utils";
import { commissionPercentForPlan } from "@/lib/plans";
import { StatCard } from "@/components/stat-card";
import { BecomeHandicapperForm } from "@/components/become-handicapper-form";
import { ConnectOnboardingBanner } from "@/components/connect-onboarding-banner";
import { CreatePickForm } from "@/components/create-pick-form";
import { HandicapperPickRow } from "@/components/handicapper-pick-row";
import { ManagePlanCard } from "@/components/manage-plan-card";
import { ProfileImagesForm } from "@/components/profile-images-form";

export const metadata: Metadata = { title: "Handicapper dashboard" };
export const dynamic = "force-dynamic";

export default async function HandicapperDashboardPage() {
  const session = await auth();
  if (!session) redirect("/signin?callbackUrl=/dashboard/handicapper");

  const handicapper = await prisma.handicapperProfile.findUnique({
    where: { userId: session.user.id },
    include: { picks: { orderBy: { eventStartsAt: "desc" } } },
  });

  if (!handicapper) {
    return (
      <div className="container-page py-12">
        <BecomeHandicapperForm />
      </div>
    );
  }

  const subscriberCount = await prisma.subscription.count({
    where: { handicapperId: handicapper.id, status: "ACTIVE" },
  });

  const stats = computeStats(handicapper.picks);
  const grossMonthlyCents = subscriberCount * handicapper.monthlyPriceCents;
  const netMonthlyCents = Math.round(
    grossMonthlyCents * (1 - commissionPercentForPlan(handicapper.plan) / 100)
  );

  return (
    <div className="container-page py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Your dashboard</h1>
          <p className="mt-1 text-muted">
            Public profile:{" "}
            <Link href={`/handicappers/${handicapper.handle}`} className="text-accent hover:underline">
              blitz.tips/handicappers/{handicapper.handle}
            </Link>
          </p>
        </div>
      </div>

      <div className="mt-6">
        <ProfileImagesForm
          avatarUrl={handicapper.avatarUrl}
          coverUrl={handicapper.coverUrl}
          displayName={handicapper.displayName}
        />
      </div>

      {!handicapper.stripeAccountReady && (
        <div className="mt-6">
          <ConnectOnboardingBanner />
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Record" value={stats.record} />
        <StatCard label="Win rate" value={stats.winRate ? `${stats.winRate.toFixed(1)}%` : "—"} />
        <StatCard label="Subscribers" value={subscriberCount.toString()} />
        <StatCard label="Est. earnings/mo" value={formatCents(netMonthlyCents)} tone="accent" />
      </div>

      <div className="mt-6">
        <ManagePlanCard
          plan={handicapper.plan}
          planStatus={handicapper.planStatus}
          planInterval={handicapper.planInterval}
          planCurrentPeriodEnd={handicapper.planCurrentPeriodEnd}
        />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[22rem_1fr]">
        <div>
          <h2 className="mb-3 font-semibold">Post a pick</h2>
          <CreatePickForm handicapperSports={handicapper.sports} />
        </div>

        <div>
          <h2 className="mb-3 font-semibold">Your picks</h2>
          {handicapper.picks.length === 0 ? (
            <p className="text-muted">You haven&apos;t posted any picks yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {handicapper.picks.map((pick) => (
                <HandicapperPickRow key={pick.id} pick={pick} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
