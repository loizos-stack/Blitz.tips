import { prisma } from "@/lib/prisma";
import { AdminButton } from "@/components/admin/admin-actions";
import { guardAdminPage } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage() {
  await guardAdminPage("subscriptions");
  const subscriptions = await prisma.subscription.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      subscriber: { select: { email: true } },
      handicapper: { select: { handle: true } },
    },
  });

  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full min-w-[48rem] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3">Subscriber</th>
            <th className="px-4 py-3">Handicapper</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Renews</th>
            <th className="px-4 py-3">Cancels at period end</th>
            <th className="px-4 py-3">Started</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {subscriptions.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-muted">
                No subscriptions yet.
              </td>
            </tr>
          ) : (
            subscriptions.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-2.5">{s.subscriber.email}</td>
                <td className="px-4 py-2.5 font-medium">@{s.handicapper.handle}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={
                      s.status === "ACTIVE"
                        ? "text-accent"
                        : s.status === "PAST_DUE"
                          ? "text-gold"
                          : "text-muted"
                    }
                  >
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-muted">
                  {s.currentPeriodEnd ? s.currentPeriodEnd.toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-2.5">{s.cancelAtPeriodEnd ? "Yes" : "—"}</td>
                <td className="px-4 py-2.5 text-muted">{s.createdAt.toLocaleDateString()}</td>
                <td className="px-4 py-2.5 text-right">
                  {s.stripeSubscriptionId && (
                    <div className="flex justify-end gap-1.5">
                      <AdminButton
                        endpoint={`/api/admin/subscriptions/${s.id}`}
                        method="POST"
                        body={{ action: "refund" }}
                        label="Refund last payment"
                        confirmText={`Refund ${s.subscriber.email}'s most recent payment for @${s.handicapper.handle}? Funds are pulled back from the handicapper and the platform fee is returned.`}
                      />
                      {s.status === "ACTIVE" && (
                        <AdminButton
                          endpoint={`/api/admin/subscriptions/${s.id}`}
                          method="POST"
                          body={{ action: "cancel" }}
                          label="Cancel"
                          tone="danger"
                          confirmText={`Cancel ${s.subscriber.email}'s subscription to @${s.handicapper.handle} immediately?`}
                        />
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
