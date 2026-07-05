import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/utils";
import { AdminSelect, AdminButton } from "@/components/admin/admin-actions";

export const dynamic = "force-dynamic";

const PLAN_OPTIONS = [
  { value: "FREE", label: "Free" },
  { value: "SILVER", label: "Silver" },
  { value: "GOLD", label: "Gold" },
];

export default async function AdminHandicappersPage() {
  const handicappers = await prisma.handicapperProfile.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: { select: { email: true } },
      _count: { select: { picks: true, subscriptions: true } },
    },
  });

  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full min-w-[64rem] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3">Handle</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Monthly</th>
            <th className="px-4 py-3">Picks</th>
            <th className="px-4 py-3">Subs</th>
            <th className="px-4 py-3">Payouts</th>
            <th className="px-4 py-3">Plan</th>
            <th className="px-4 py-3">Verified badge</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {handicappers.map((h) => (
            <tr key={h.id} className="border-b border-border last:border-b-0">
              <td className="px-4 py-2.5 font-medium">@{h.handle}</td>
              <td className="px-4 py-2.5 text-muted">{h.user.email}</td>
              <td className="px-4 py-2.5 tabular-nums">{formatCents(h.monthlyPriceCents)}</td>
              <td className="px-4 py-2.5 tabular-nums">{h._count.picks}</td>
              <td className="px-4 py-2.5 tabular-nums">{h._count.subscriptions}</td>
              <td className="px-4 py-2.5">{h.stripeAccountReady ? <span className="text-accent">✓</span> : "—"}</td>
              <td className="px-4 py-2.5">
                <AdminSelect
                  endpoint={`/api/admin/handicappers/${h.id}`}
                  field="plan"
                  value={h.plan}
                  options={PLAN_OPTIONS}
                />
              </td>
              <td className="px-4 py-2.5">
                <AdminButton
                  endpoint={`/api/admin/handicappers/${h.id}`}
                  body={{ isVerified: !h.isVerified }}
                  label={h.isVerified ? "✓ Verified — revoke" : "Grant badge"}
                />
              </td>
              <td className="px-4 py-2.5 text-right">
                <AdminButton
                  endpoint={`/api/admin/handicappers/${h.id}`}
                  method="DELETE"
                  label="Delete"
                  tone="danger"
                  confirmText={`Delete @${h.handle}'s profile, picks, and subscriptions? The user account stays. This cannot be undone.`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
