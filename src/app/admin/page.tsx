import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/stat-card";
import { formatCents } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const [users, handicappers, picks, pendingPicks, activeSubs, planCounts, recentUsers] =
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
    ]);

  // Rough gross MRR: active subscriptions at each handicapper's monthly price.
  // (Weekly/annual packages are approximated at the monthly rate.)
  const grossMrrCents = activeSubs.reduce((sum, s) => sum + s.handicapper.monthlyPriceCents, 0);

  const plans = Object.fromEntries(planCounts.map((p) => [p.plan, p._count]));

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Users" value={users.toString()} />
        <StatCard label="Handicappers" value={handicappers.toString()} />
        <StatCard label="Active subscriptions" value={activeSubs.length.toString()} />
        <StatCard label="Gross MRR (approx)" value={formatCents(grossMrrCents)} tone="accent" />
        <StatCard label="Picks tracked" value={picks.toString()} />
        <StatCard label="Pending picks" value={pendingPicks.toString()} />
        <StatCard
          label="Paid plans"
          value={`${(plans.SILVER ?? 0) + (plans.GOLD ?? 0)} (${plans.GOLD ?? 0} gold)`}
        />
        <StatCard label="Free plans" value={(plans.FREE ?? 0).toString()} />
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
