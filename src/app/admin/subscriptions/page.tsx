import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage() {
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
          </tr>
        </thead>
        <tbody>
          {subscriptions.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-muted">
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
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
