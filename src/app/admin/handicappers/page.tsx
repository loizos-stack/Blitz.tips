import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/utils";
import { AdminButton } from "@/components/admin/admin-actions";
import { CompPlanControl } from "@/components/admin/comp-plan-control";
import { guardAdminPage } from "@/lib/permissions";
import { markAdminTabSeen } from "@/lib/admin-badges";
import { whyNotComped } from "@/lib/comped-plans";

export const dynamic = "force-dynamic";

export default async function AdminHandicappersPage() {
  const ctx = await guardAdminPage("handicappers");
  after(() => markAdminTabSeen(ctx.userId, "handicappers"));
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
            <th className="px-4 py-3">Plan / comp</th>
            <th className="px-4 py-3">Verified badge</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {handicappers.map((h) => (
            <tr key={h.id} className="border-b border-border last:border-b-0">
              <td className="px-4 py-2.5 font-medium">
                @{h.handle}
                {h.suspendedAt && (
                  <span className="ml-2 rounded-full bg-danger/15 px-1.5 py-0.5 text-[10px] font-bold text-danger">
                    SUSPENDED
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-muted">{h.user.email}</td>
              <td className="px-4 py-2.5 tabular-nums">{formatCents(h.monthlyPriceCents)}</td>
              <td className="px-4 py-2.5 tabular-nums">{h._count.picks}</td>
              <td className="px-4 py-2.5 tabular-nums">{h._count.subscriptions}</td>
              <td className="px-4 py-2.5">{h.stripeAccountReady ? <span className="text-accent">✓</span> : "—"}</td>
              <td className="px-4 py-2.5">
                <CompPlanControl
                  handicapperId={h.id}
                  handle={h.handle}
                  plan={h.plan}
                  compedUntil={h.planCompedUntil ? h.planCompedUntil.toISOString() : null}
                  blockedReason={whyNotComped(h)}
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
                <div className="flex justify-end gap-1.5">
                  <AdminButton
                    endpoint={`/api/admin/handicappers/${h.id}`}
                    body={{ suspended: !h.suspendedAt }}
                    label={h.suspendedAt ? "Unsuspend" : "Suspend"}
                    tone={h.suspendedAt ? "default" : "danger"}
                    confirmText={
                      h.suspendedAt
                        ? undefined
                        : `Suspend @${h.handle}? Their profile is hidden and they can't post picks or take subscribers until unsuspended.`
                    }
                  />
                  <AdminButton
                    endpoint={`/api/admin/handicappers/${h.id}`}
                    method="DELETE"
                    label="Delete"
                    tone="danger"
                    confirmText={`Delete @${h.handle}'s profile, picks, and subscriptions? The user account stays. This cannot be undone.`}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
