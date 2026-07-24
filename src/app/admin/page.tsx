import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/stat-card";
import { formatCents } from "@/lib/utils";
import { guardAdminPage } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const TREND_WEEKS = 8;

// Bucket createdAt timestamps into the last N weeks for the mini charts.
function weeklyBuckets(dates: Date[], now: number): { label: string; count: number }[] {
  const week = 7 * 24 * 60 * 60 * 1000;
  return Array.from({ length: TREND_WEEKS }, (_, i) => {
    const end = now - (TREND_WEEKS - 1 - i) * week;
    const start = end - week;
    const count = dates.filter((d) => d.getTime() > start && d.getTime() <= end).length;
    const label = new Date(end).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return { label, count };
  });
}

function TrendChart({ title, buckets }: { title: string; buckets: { label: string; count: number }[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div className="card p-5">
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-3 flex h-24 items-end gap-1.5">
        {buckets.map((b, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1" title={`${b.label}: ${b.count}`}>
            <span className="text-[10px] tabular-nums text-muted">{b.count > 0 ? b.count : ""}</span>
            <div
              className="w-full rounded-t bg-accent/70"
              style={{ height: `${Math.max(3, (b.count / max) * 72)}px` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>{buckets[0]?.label}</span>
        <span>{buckets[buckets.length - 1]?.label}</span>
      </div>
    </div>
  );
}

// Data loading lives outside the component so wall-clock reads don't trip the
// render-purity lint; a server component fetching per-request data is expected.
async function loadOverviewData() {
  const trendNow = Date.now();
  const trendCutoff = new Date(trendNow - TREND_WEEKS * 7 * 24 * 60 * 60 * 1000);
  const [users, handicappers, picks, pendingPicks, activeSubs, planCounts, recentUsers, userDates, subDates] =
    await Promise.all([
      prisma.user.count(),
      prisma.handicapperProfile.count(),
      prisma.pick.count(),
      prisma.pick.count({ where: { result: "PENDING" } }),
      prisma.subscription.findMany({
        where: { status: "ACTIVE" },
        include: { handicapper: { select: { monthlyPriceCents: true } } },
      }),
      prisma.handicapperProfile.groupBy({ by: ["plan"], _count: true }),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, email: true, name: true, role: true, createdAt: true, emailVerified: true },
      }),
      prisma.user.findMany({
        where: { createdAt: { gt: trendCutoff } },
        select: { createdAt: true },
      }),
      prisma.subscription.findMany({
        where: { createdAt: { gt: trendCutoff } },
        select: { createdAt: true },
      }),
    ]);

  // Rough gross MRR: active subscriptions at each handicapper's monthly price.
  // (Weekly/annual packages are approximated at the monthly rate.)
  const grossMrrCents = activeSubs.reduce((sum, s) => sum + s.handicapper.monthlyPriceCents, 0);

  const plans = Object.fromEntries(planCounts.map((p) => [p.plan, p._count]));

  return {
    users,
    handicappers,
    picks,
    pendingPicks,
    activeSubsCount: activeSubs.length,
    grossMrrCents,
    plans,
    recentUsers,
    trendNow,
    userDates,
    subDates,
  };
}

export default async function AdminOverviewPage() {
  await guardAdminPage("overview");
  const {
    users,
    handicappers,
    picks,
    pendingPicks,
    activeSubsCount,
    grossMrrCents,
    plans,
    recentUsers,
    trendNow,
    userDates,
    subDates,
  } = await loadOverviewData();

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Users" value={users.toString()} />
        <StatCard label="Handicappers" value={handicappers.toString()} />
        <StatCard label="Active subscriptions" value={activeSubsCount.toString()} />
        <StatCard label="Gross MRR (approx)" value={formatCents(grossMrrCents)} tone="accent" />
        <StatCard label="Picks tracked" value={picks.toString()} />
        <StatCard label="Pending picks" value={pendingPicks.toString()} />
        <StatCard
          label="Paid plans"
          value={`${(plans.SILVER ?? 0) + (plans.GOLD ?? 0)} (${plans.GOLD ?? 0} gold)`}
        />
        <StatCard label="Free plans" value={(plans.FREE ?? 0).toString()} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <TrendChart
          title={`Signups (last ${TREND_WEEKS} weeks)`}
          buckets={weeklyBuckets(userDates.map((u) => u.createdAt), trendNow)}
        />
        <TrendChart
          title={`New subscriptions (last ${TREND_WEEKS} weeks)`}
          buckets={weeklyBuckets(subDates.map((s) => s.createdAt), trendNow)}
        />
      </div>

      <h2 className="mb-3 mt-8 font-semibold">Newest accounts</h2>
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Verified</th>
              <th className="px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {recentUsers.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-2.5">{u.email}</td>
                <td className="px-4 py-2.5">{u.name ?? "—"}</td>
                <td className="px-4 py-2.5">{u.role}</td>
                <td className="px-4 py-2.5">{u.emailVerified ? "✓" : "—"}</td>
                <td className="px-4 py-2.5 text-muted">{u.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
