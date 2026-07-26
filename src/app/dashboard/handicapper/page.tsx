import { prisma } from "@/lib/prisma";
import { computeStats } from "@/lib/odds";
import { computeStreaks, formatStreak, formatUnits } from "@/lib/analytics";
import { formatCents } from "@/lib/utils";
import { commissionPercentForPlan } from "@/lib/plans";
import { StatCard } from "@/components/stat-card";
import { BecomeHandicapperForm } from "@/components/become-handicapper-form";
import { ContestPromoBanner } from "@/components/contest/contest-promo-banner";
import { loadDashboardHandicapper } from "@/lib/handicapper-dashboard";

export const dynamic = "force-dynamic";

export default async function HandicapperOverviewPage() {
  const { handicapper } = await loadDashboardHandicapper();
  if (!handicapper) return <BecomeHandicapperForm />;

  const subscriberCount = await prisma.subscription.count({
    where: { handicapperId: handicapper.id, status: "ACTIVE" },
  });

  const stats = computeStats(handicapper.picks);
  const streaks = computeStreaks(handicapper.picks);
  const grossMonthlyCents = subscriberCount * handicapper.monthlyPriceCents;
  const netMonthlyCents = Math.round(
    grossMonthlyCents * (1 - commissionPercentForPlan(handicapper.plan) / 100)
  );

  return (
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

      <ContestPromoBanner className="mt-2" />
    </div>
  );
}
