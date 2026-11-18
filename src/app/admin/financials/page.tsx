import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/stat-card";
import { formatCents } from "@/lib/utils";
import { commissionPercentForPlan, planPriceCents } from "@/lib/plans";
import { guardAdminPage } from "@/lib/permissions";
import { hasActiveComp, isPlanPaidFor } from "@/lib/comped-plans";
import { formatDate } from "@/lib/date-format";
import { directPaymentSettings, SUGGESTED_METHODS } from "@/lib/direct-payments";
import {
  DirectPaymentSettings,
  PendingDirectPayments,
  RecordPayout,
} from "@/components/admin/direct-payments-admin";

export const dynamic = "force-dynamic";

/**
 * A subscription that is ACTIVE but was given away, not bought.
 *
 * `compedAt` alone is not the test. Someone comped last month may have started
 * paying since, and a Stripe subscription means real money however the access
 * began — so a Stripe id wins over the comp stamp.
 */
const PAID_SUBSCRIPTION: Prisma.SubscriptionWhereInput = {
  status: "ACTIVE",
  OR: [{ compedAt: null }, { stripeSubscriptionId: { not: null } }],
};

// Money view built from the database. Amounts are estimates: subscriptions are
// counted at each handicapper's monthly price (weekly/annual packages
// approximated), and Stripe fees aren't subtracted — the exact ledger lives in
// the Stripe dashboard.
//
// What it does NOT estimate is anything given away. A comped subscription and
// a comped Silver/Gold plan both look exactly like the paid article in the
// database — ACTIVE, full access, a price attached — and counting them was
// reporting money nobody sent. They are excluded from every figure here and
// listed separately below, where what they cost is the point.
export default async function AdminFinancialsPage() {
  await guardAdminPage("financials");
  const [
    handicappers,
    activeSubs,
    cryptoPayments,
    compedSubs,
    directConfirmed,
    directPending,
    payouts,
    directSettings,
  ] = await Promise.all([
    prisma.handicapperProfile.findMany({
      include: {
        _count: { select: { subscriptions: { where: PAID_SUBSCRIPTION } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.subscription.count({ where: PAID_SUBSCRIPTION }),
    prisma.cryptoPayment.findMany({ where: { status: "CONFIRMED" } }),
    prisma.subscription.findMany({
      where: { compedAt: { not: null }, stripeSubscriptionId: null },
      orderBy: { compedAt: "desc" },
      take: 200,
      select: {
        id: true,
        compedAt: true,
        compedByEmail: true,
        currentPeriodEnd: true,
        status: true,
        subscriber: { select: { email: true } },
        handicapper: { select: { handle: true, monthlyPriceCents: true } },
      },
    }),
    prisma.directPayment.findMany({ where: { status: "CONFIRMED" } }),
    prisma.directPayment.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
    prisma.handicapperPayout.findMany({ orderBy: { paidAt: "desc" } }),
    directPaymentSettings(),
  ]);

  // What is owed, and what has gone out. Both crypto and direct transfers are
  // money the platform received on a handicapper's behalf, so they belong in
  // one figure; payouts come off it. Stripe is absent on purpose — Stripe
  // pays the handicapper itself, so there is nothing to settle by hand.
  const owedByHandicapper = new Map<
    string,
    { gross: number; cut: number; net: number; paid: number; count: number }
  >();
  const bucket = (id: string) => {
    let row = owedByHandicapper.get(id);
    if (!row) owedByHandicapper.set(id, (row = { gross: 0, cut: 0, net: 0, paid: 0, count: 0 }));
    return row;
  };
  for (const p of [...cryptoPayments, ...directConfirmed]) {
    const row = bucket(p.handicapperId);
    row.count += 1;
    row.gross += p.amountCents;
    row.cut += p.commissionCents;
    row.net += p.netCents;
  }
  for (const p of payouts) bucket(p.handicapperId).paid += p.amountCents;

  const owedRows = [...owedByHandicapper.entries()]
    .map(([handicapperId, r]) => ({ handicapperId, ...r, outstanding: r.net - r.paid }))
    .filter((r) => r.count > 0 || r.paid > 0)
    .sort((a, b) => b.outstanding - a.outstanding);

  const subscriberEmails = new Map(
    (
      await prisma.user.findMany({
        where: { id: { in: directPending.map((p) => p.subscriberId) } },
        select: { id: true, email: true },
      })
    ).map((u) => [u.id, u.email])
  );

  // Handicapper plans that were given rather than bought, from the same admin
  // panel. Same problem, different table.
  //
  // Every row that still carries an end date, not only the running ones: a comp
  // that ran out is still giving away the plan until the daily sweep demotes
  // them, and that gap is exactly when someone would come here asking why a
  // handicapper is on Gold for nothing. The sweep clears the columns, so these
  // rows disappear on their own.
  const compedPlans = handicappers.filter((h) => h.planCompedUntil !== null);

  // HandicapperProfile stores only the granting admin's id, so resolve the
  // emails here. "Given by" naming a cuid tells nobody anything.
  const granterIds = [...new Set(compedPlans.map((h) => h.planCompedById).filter((id): id is string => Boolean(id)))];
  const granters = new Map(
    granterIds.length === 0
      ? []
      : (
          await prisma.user.findMany({
            where: { id: { in: granterIds } },
            select: { id: true, email: true },
          })
        ).map((u) => [u.id, u.email] as const)
  );

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
  // "Non-FREE and ACTIVE" used to stand in for "paid", which counted comps,
  // comps the daily sweep hasn't cleared yet, and lapsed crypto plans — each at
  // full list price. See isPlanPaidFor.
  const paidPlans = handicappers.filter((h) => isPlanPaidFor(h));
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

      <PendingDirectPayments
        payments={directPending.map((p) => ({
          id: p.id,
          reference: p.reference,
          createdAt: p.createdAt.toISOString(),
          interval: p.interval,
          amountCents: p.amountCents,
          currency: p.currency,
          netCents: p.netCents,
          method: p.method,
          note: p.note,
          subscriberEmail: subscriberEmails.get(p.subscriberId) ?? p.subscriberId,
          handle: handicappers.find((h) => h.id === p.handicapperId)?.handle ?? p.handicapperId,
        }))}
      />

      {owedRows.length > 0 && (
        <>
          <div className="mb-3 mt-8 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Owed to handicappers</h2>
            <RecordPayout
              handicappers={owedRows.map((r) => {
                const h = handicappers.find((x) => x.id === r.handicapperId);
                return {
                  id: r.handicapperId,
                  handle: h?.handle ?? r.handicapperId,
                  owedCents: Math.max(r.outstanding, 0),
                  currency: h?.priceCurrency ?? "USD",
                };
              })}
            />
          </div>
          <p className="mb-3 text-xs text-muted">
            Passes bought with crypto or paid straight to you. That money reached your account,
            not the handicapper&apos;s, so their share is sent by hand — record each transfer and
            the outstanding column comes down. Stripe subscriptions are not here: Stripe pays the
            handicapper directly, so there is nothing to settle.
          </p>
          <div className="card overflow-x-auto p-0">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Handicapper</th>
                  <th className="px-4 py-3">Passes</th>
                  <th className="px-4 py-3">Gross</th>
                  <th className="px-4 py-3">Platform cut</th>
                  <th className="px-4 py-3">Their share</th>
                  <th className="px-4 py-3">Paid out</th>
                  <th className="px-4 py-3">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {owedRows.map((r) => {
                  const h = handicappers.find((x) => x.id === r.handicapperId);
                  const currency = h?.priceCurrency ?? "USD";
                  return (
                    <tr key={r.handicapperId} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-2.5 font-medium">@{h?.handle ?? r.handicapperId}</td>
                      <td className="px-4 py-2.5 tabular-nums">{r.count}</td>
                      <td className="px-4 py-2.5 tabular-nums">{formatCents(r.gross, currency)}</td>
                      <td className="px-4 py-2.5 tabular-nums text-accent">
                        {formatCents(r.cut, currency)}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">{formatCents(r.net, currency)}</td>
                      <td className="px-4 py-2.5 tabular-nums text-muted">
                        {formatCents(r.paid, currency)}
                      </td>
                      {/* Overpaid reads as a credit rather than a negative
                          debt, because "-12.00 owed" is a sentence nobody
                          parses correctly at a glance. */}
                      <td className="px-4 py-2.5 tabular-nums font-semibold">
                        {r.outstanding < 0
                          ? `${formatCents(-r.outstanding, currency)} ahead`
                          : formatCents(r.outstanding, currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {payouts.length > 0 && (
            <p className="mt-2 text-xs text-muted">
              Last payout: {formatCents(payouts[0].amountCents, payouts[0].currency)} via{" "}
              {payouts[0].method} on {formatDate(payouts[0].paidAt)}
              {payouts[0].recordedByEmail ? `, recorded by ${payouts[0].recordedByEmail}` : ""}.
            </p>
          )}
        </>
      )}

      <h2 className="mb-3 mt-8 font-semibold">Given away</h2>
      <p className="mb-3 text-xs text-muted">
        Packages and plans an admin handed out. None of this is counted anywhere above — that is
        the point of the table: it is what was given, by whom, and what it would have been worth
        if it had been sold. A comped subscription is valued at the handicapper&apos;s monthly
        price, a comped plan at its list price.
      </p>
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[52rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">What</th>
              <th className="px-4 py-3">Who got it</th>
              <th className="px-4 py-3">Given by</th>
              <th className="px-4 py-3">Given</th>
              <th className="px-4 py-3">Until</th>
              <th className="px-4 py-3">Would have cost</th>
            </tr>
          </thead>
          <tbody>
            {compedSubs.length === 0 && compedPlans.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  Nothing has been given away.
                </td>
              </tr>
            ) : (
              <>
                {compedPlans.map((h) => (
                  <tr key={`plan-${h.id}`} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2.5 font-medium">
                      {h.plan} plan
                      {!hasActiveComp(h) && (
                        <span className="ml-2 rounded-full bg-muted/15 px-1.5 py-0.5 text-[10px] font-bold text-muted">
                          ENDED
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">@{h.handle}</td>
                    <td className="px-4 py-2.5 text-muted">
                      {(h.planCompedById && granters.get(h.planCompedById)) ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-muted">
                      {h.planCompedAt ? formatDate(h.planCompedAt) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-muted">
                      {h.planCompedUntil ? formatDate(h.planCompedUntil) : "—"}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {formatCents(planPriceCents(h.plan, h.planInterval ?? "MONTHLY") ?? 0)}
                      <span className="text-muted"> /mo</span>
                    </td>
                  </tr>
                ))}
                {compedSubs.map((s) => (
                  <tr key={`sub-${s.id}`} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2.5 font-medium">
                      Subscription to @{s.handicapper.handle}
                      {s.status !== "ACTIVE" && (
                        <span className="ml-2 rounded-full bg-muted/15 px-1.5 py-0.5 text-[10px] font-bold text-muted">
                          {s.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">{s.subscriber.email}</td>
                    <td className="px-4 py-2.5 text-muted">{s.compedByEmail ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted">
                      {s.compedAt ? formatDate(s.compedAt) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-muted">
                      {s.currentPeriodEnd ? formatDate(s.currentPeriodEnd) : "open-ended"}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {formatCents(s.handicapper.monthlyPriceCents)}
                      <span className="text-muted"> /mo</span>
                    </td>
                  </tr>
                ))}
              </>
            )}
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

      <div className="mt-8">
        <DirectPaymentSettings
          initial={{
            enabled: directSettings.enabled,
            methods: directSettings.methods,
            instructions: directSettings.instructions,
          }}
          suggested={SUGGESTED_METHODS}
        />
      </div>
    </div>
  );
}
