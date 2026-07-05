import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/stat-card";
import { formatCents } from "@/lib/utils";
import { commissionPercentForPlan, planPriceCents } from "@/lib/plans";
import { guardAdminPage } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Money view built from the database. Amounts are estimates: subscriptions are
// counted at each handicapper's monthly price (weekly/annual packages
// approximated), and Stripe fees aren't subtracted — the exact ledger lives in
// the Stripe dashboard.
export default async function AdminFinancialsPage() {
  await guardAdminPage("financials");
  const [handicappers, activeSubs] = await Promise.all([
    prisma.handicapperProfile.findMany({
      include: {
        _count: { select: { subscriptions: { where: { status: "ACTIVE" } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
  ]);

  const rows = handicappers
    .map((h) => {
      const subs = h._count.subscriptions;
      const grossCents = subs * h.monthlyPriceCents;
      const commissionPct = commissionPercentForPlan(h.plan);
      const platformCents = Math.round((grossCents * commissionPct) / 100);
      return {
        id: h.id,
        handle: h.handle,
        plan: h.plan,
        planStatus: h.planStatus,
        planInterval: h.planInterval,
        subs,
        grossCents,
        commissionPct,
        platformCents,
        payoutCents: grossCents - platformCents,
      };
    })
    .sort((a, b) => b.grossCents - a.grossCents);

  const grossMrr = rows.reduce((s, r) => s + r.grossCents, 0);
  const commissionMrr = rows.reduce((s, r) => s + r.platformCents, 0);

  // Handicapper plan revenue (Silver/Gold), normalized to a monthly figure.
  const paidPlans = handicappers.filter((h) => h.plan !== "FREE" && h.planStatus === "ACTIVE");
  const planMrr = paidPlans.reduce((sum, h) => {
    const interval = h.planInterval ?? "MONTHLY";
    const price = planPriceCents(h.plan, interval) ?? 0;
    return sum + (interval === "ANNUAL" ? Math.round(price / 12) : price);
  }, 0);

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Gross subscription MRR" value={formatCents(grossMrr)} />
        <StatCard label="Commission MRR (platform)" value={formatCents(commissionMrr)} tone="accent" />
        <StatCard label="Plan MRR (platform)" value={formatCents(planMrr)} tone="accent" />
        <StatCard label="Total platform MRR" value={formatCents(commissionMrr + planMrr)} tone="accent" />
      </div>
      <p className="mt-2 text-xs text-muted">
        Estimates from {activeSubs} active subscription{activeSubs === 1 ? "" : "s"} at monthly package
        rates, before Stripe processing fees. The authoritative ledger is your Stripe dashboard.
      </p>

      <h2 className="mb-3 mt-8 font-semibold">Per handicapper</h2>
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[56rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Handicapper</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Active subs</th>
              <th className="px-4 py-3">Gross / mo</th>
              <th className="px-4 py-3">Commission</th>
              <th className="px-4 py-3">Platform cut / mo</th>
              <th className="px-4 py-3">Capper payout / mo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-2.5 font-medium">@{r.handle}</td>
                <td className="px-4 py-2.5">
                  {r.plan}
                  {r.plan !== "FREE" && r.planStatus !== "ACTIVE" && (
                    <span className="ml-1 text-xs text-danger">({r.planStatus})</span>
                  )}
                </td>
                <td className="px-4 py-2.5 tabular-nums">{r.subs}</td>
                <td className="px-4 py-2.5 tabular-nums">{formatCents(r.grossCents)}</td>
                <td className="px-4 py-2.5 tabular-nums">{r.commissionPct}%</td>
                <td className="px-4 py-2.5 tabular-nums text-accent">{formatCents(r.platformCents)}</td>
                <td className="px-4 py-2.5 tabular-nums">{formatCents(r.payoutCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3 mt-8 font-semibold">Paid handicapper plans</h2>
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Handicapper</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Billing</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">≈ Monthly</th>
            </tr>
          </thead>
          <tbody>
            {paidPlans.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  No paid plans yet.
                </td>
              </tr>
            ) : (
              paidPlans.map((h) => {
                const interval = h.planInterval ?? "MONTHLY";
                const price = planPriceCents(h.plan, interval) ?? 0;
                return (
                  <tr key={h.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2.5 font-medium">@{h.handle}</td>
                    <td className="px-4 py-2.5">{h.plan}</td>
                    <td className="px-4 py-2.5">{interval}</td>
                    <td className="px-4 py-2.5 tabular-nums">{formatCents(price)}</td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {formatCents(interval === "ANNUAL" ? Math.round(price / 12) : price)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
