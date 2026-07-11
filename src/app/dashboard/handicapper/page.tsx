import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeStats } from "@/lib/odds";
import {
  breakdownBy,
  computeStreaks,
  cumulativeUnits,
  formatStreak,
  formatUnits,
  statsSince,
} from "@/lib/analytics";
import { formatCents, SPORT_LABELS, BET_TYPE_LABELS } from "@/lib/utils";
import { commissionPercentForPlan } from "@/lib/plans";
import { StatCard } from "@/components/stat-card";
import { UnitsChart } from "@/components/dashboard/units-chart";
import { BreakdownTable } from "@/components/dashboard/breakdown-table";
import { BecomeHandicapperForm } from "@/components/become-handicapper-form";
import { ConnectOnboardingBanner, StripePayoutsCard } from "@/components/connect-onboarding-banner";
import { syncConnectStatus } from "@/lib/connect";
import { PostTipForms } from "@/components/post-tip-forms";
import { HandicapperPickList } from "@/components/handicapper-pick-list";
import { enrichPickCrests } from "@/lib/pick-logos";
import { ManagePlanCard } from "@/components/manage-plan-card";
import { ProfileImagesForm } from "@/components/profile-images-form";
import { PricingPackagesCard } from "@/components/pricing-packages-card";
import { SocialsForm } from "@/components/socials-form";
import { TestimonialsForm } from "@/components/testimonials-form";
import { VerifyEmailBanner } from "@/components/verify-email-banner";
import { getSetting } from "@/lib/settings";
import { DASHBOARD_ORDER_SETTING, resolveSectionOrder } from "@/lib/dashboard-sections";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Handicapper dashboard" };
export const dynamic = "force-dynamic";

export default async function HandicapperDashboardPage() {
  const session = await auth();
  if (!session) redirect("/signin?callbackUrl=/dashboard/handicapper");

  const [handicapper, currentUser] = await Promise.all([
    prisma.handicapperProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        picks: { orderBy: { eventStartsAt: "desc" } },
        testimonials: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emailVerified: true },
    }),
  ]);

  const unverified = !currentUser?.emailVerified;

  if (!handicapper) {
    return (
      <div className="container-page space-y-6 py-12">
        {unverified && <VerifyEmailBanner />}
        <BecomeHandicapperForm />
      </div>
    );
  }

  // Self-healing Connect status: when an account exists but isn't marked
  // ready, check Stripe directly — covers a missing/misconfigured webhook and
  // the return from onboarding.
  const stripeReady =
    handicapper.stripeAccountId && !handicapper.stripeAccountReady
      ? await syncConnectStatus(handicapper)
      : handicapper.stripeAccountReady;

  const subscriberCount = await prisma.subscription.count({
    where: { handicapperId: handicapper.id, status: "ACTIVE" },
  });

  const stats = computeStats(handicapper.picks);
  const streaks = computeStreaks(handicapper.picks);
  const unitsSeries = cumulativeUnits(handicapper.picks);
  const last30 = statsSince(handicapper.picks, 30);
  const bySport = breakdownBy(
    handicapper.picks,
    (p) => p.sport,
    (k) => SPORT_LABELS[k] ?? k
  );
  const byBetType = breakdownBy(
    handicapper.picks,
    (p) => p.betType,
    (k) => BET_TYPE_LABELS[k] ?? k
  );

  // Crests for the handicapper's own pick list.
  const displayPicks = await enrichPickCrests(handicapper.picks);

  const grossMonthlyCents = subscriberCount * handicapper.monthlyPriceCents;
  const netMonthlyCents = Math.round(
    grossMonthlyCents * (1 - commissionPercentForPlan(handicapper.plan) / 100)
  );

  // The reorderable sections, keyed by the CMS catalog. An admin can rearrange
  // these from /admin/cms; the header, verify banner, profile images and Stripe
  // banner stay pinned to the top regardless of order.
  const sections: Record<string, ReactNode> = {
    postPick: (
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-3">
          <h2 className="font-semibold">Post a tip</h2>
          <PostTipForms handicapperSports={handicapper.sports} />
        </div>

        <div>
          <h2 className="mb-3 font-semibold">Your picks</h2>
          {displayPicks.length === 0 ? (
            <p className="text-muted">You haven&apos;t posted any picks yet.</p>
          ) : (
            <HandicapperPickList picks={displayPicks} />
          )}
        </div>
      </div>
    ),
    stats: (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Record" value={stats.record} />
          <StatCard label="Win rate" value={stats.winRate ? `${stats.winRate.toFixed(1)}%` : "—"} />
          <StatCard label="Subscribers" value={subscriberCount.toString()} />
          <StatCard label="Est. earnings/mo" value={formatCents(netMonthlyCents, handicapper.priceCurrency)} tone="accent" />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Units net"
            value={formatUnits(stats.unitsNet)}
            tone={stats.unitsNet > 0 ? "accent" : stats.unitsNet < 0 ? "danger" : "default"}
          />
          <StatCard
            label="ROI"
            value={stats.roi != null ? `${stats.roi > 0 ? "+" : ""}${stats.roi.toFixed(1)}%` : "—"}
            tone={stats.roi != null && stats.roi > 0 ? "accent" : stats.roi != null && stats.roi < 0 ? "danger" : "default"}
          />
          <StatCard
            label="Current streak"
            value={formatStreak(streaks.current)}
            tone={streaks.current > 0 ? "accent" : streaks.current < 0 ? "danger" : "default"}
          />
          <StatCard label="Pending" value={stats.pending.toString()} />
        </div>
      </div>
    ),
    performance: (
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Units over time</p>
            <span
              className={
                stats.unitsNet > 0
                  ? "text-sm font-semibold text-accent"
                  : stats.unitsNet < 0
                    ? "text-sm font-semibold text-danger"
                    : "text-sm font-semibold text-muted"
              }
            >
              {formatUnits(stats.unitsNet)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">Cumulative profit/loss across your settled picks.</p>
          <UnitsChart points={unitsSeries} className="mt-4" />
        </div>

        <div className="card p-5">
          <p className="font-semibold">Last 30 days</p>
          <p className="mt-1 text-xs text-muted">Rolling form from recently settled picks.</p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold tabular-nums">{last30.record}</p>
              <p className="text-xs text-muted">Record</p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {last30.winRate != null ? `${last30.winRate.toFixed(0)}%` : "—"}
              </p>
              <p className="text-xs text-muted">Win rate</p>
            </div>
            <div>
              <p
                className={
                  last30.unitsNet > 0
                    ? "text-2xl font-bold tabular-nums text-accent"
                    : last30.unitsNet < 0
                      ? "text-2xl font-bold tabular-nums text-danger"
                      : "text-2xl font-bold tabular-nums"
                }
              >
                {formatUnits(last30.unitsNet)}
              </p>
              <p className="text-xs text-muted">Units</p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {last30.roi != null ? `${last30.roi > 0 ? "+" : ""}${last30.roi.toFixed(0)}%` : "—"}
              </p>
              <p className="text-xs text-muted">ROI</p>
            </div>
          </div>
          <div className="mt-4 border-t border-border pt-3 text-xs text-muted">
            Best win streak <span className="font-semibold text-foreground">{streaks.bestWin || "—"}</span>
            {"  ·  "}
            Longest losing streak{" "}
            <span className="font-semibold text-foreground">{streaks.worstLoss || "—"}</span>
          </div>
        </div>
      </div>
    ),
    breakdowns: (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-0">
          <p className="px-5 pt-5 font-semibold">By sport</p>
          <div className="mt-3">
            <BreakdownTable rows={bySport} firstColumn="Sport" />
          </div>
        </div>
        <div className="card p-0">
          <p className="px-5 pt-5 font-semibold">By bet type</p>
          <div className="mt-3">
            <BreakdownTable rows={byBetType} firstColumn="Bet type" />
          </div>
        </div>
      </div>
    ),
    plan: (
      <ManagePlanCard
        plan={handicapper.plan}
        planStatus={handicapper.planStatus}
        planInterval={handicapper.planInterval}
        planCurrentPeriodEnd={handicapper.planCurrentPeriodEnd}
      />
    ),
    pricing: (
      <PricingPackagesCard
        weeklyPriceCents={handicapper.weeklyPriceCents}
        monthlyPriceCents={handicapper.monthlyPriceCents}
        annualPriceCents={handicapper.annualPriceCents}
        subscriptionTrialDays={handicapper.subscriptionTrialDays}
        priceCurrency={handicapper.priceCurrency}
      />
    ),
    community: (
      <div className="grid gap-4 lg:grid-cols-2">
        <SocialsForm
          initial={{
            xUrl: handicapper.xUrl,
            instagramUrl: handicapper.instagramUrl,
            youtubeUrl: handicapper.youtubeUrl,
            tiktokUrl: handicapper.tiktokUrl,
            discordUrl: handicapper.discordUrl,
            telegramUrl: handicapper.telegramUrl,
            websiteUrl: handicapper.websiteUrl,
          }}
        />
        <TestimonialsForm
          initial={handicapper.testimonials.map((t) => ({ id: t.id, author: t.author, quote: t.quote }))}
        />
      </div>
    ),
  };

  const order = resolveSectionOrder("handicapper", await getSetting(DASHBOARD_ORDER_SETTING.handicapper));

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

      {unverified && (
        <div className="mt-6">
          <VerifyEmailBanner />
        </div>
      )}

      <div className="mt-6">
        <ProfileImagesForm
          avatarUrl={handicapper.avatarUrl}
          coverUrl={handicapper.coverUrl}
          displayName={handicapper.displayName}
        />
      </div>

      <div className="mt-6">
        {stripeReady ? (
          <StripePayoutsCard />
        ) : (
          <ConnectOnboardingBanner resume={Boolean(handicapper.stripeAccountId)} />
        )}
      </div>

      {order.map((key) => (
        <div key={key} className="mt-6">
          {sections[key]}
        </div>
      ))}
    </div>
  );
}
