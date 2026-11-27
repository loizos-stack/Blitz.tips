import { Wallet, CalendarClock } from "lucide-react";
import { formatCents } from "@/lib/utils";
import { formatDateWithWeekday, formatDate } from "@/lib/date-format";
import { nextPayoutDate, payoutIsToday } from "@/lib/payout-schedule";
import type { HandicapperBalance } from "@/lib/handicapper-balance";
import type { PriceCurrency } from "@prisma/client";

/**
 * What a handicapper who hasn't connected Stripe is owed, and when it arrives.
 *
 * Shown because the alternative is worse: without it, someone selling
 * subscriptions through the platform's own Stripe account sees money leave
 * their subscribers and nothing anywhere saying it is theirs. A balance they
 * cannot see is a balance they have to ask about.
 *
 * The date is half the point. An amount with no date reads as "someday", so
 * the outstanding figure leads with the Tuesday it will be sent on, and the
 * copy states that these transfers are sent by hand rather than implying an
 * automatic payout.
 */
export function ManualPayoutCard({
  balance,
  currency,
  connected,
}: {
  balance: HandicapperBalance;
  currency: PriceCurrency;
  /** True once Stripe Connect is live — then this is history, not the future. */
  connected: boolean;
}) {
  if (balance.count === 0 && balance.paidCents === 0) return null;

  const due = balance.outstandingCents > 0;
  const payday = nextPayoutDate();
  const today = payoutIsToday();

  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-start gap-2">
        <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <div>
          <h2 className="font-semibold">Paid to you by Blitz.tips</h2>
          <p className="mt-1 text-sm text-muted">
            {connected
              ? "Subscriptions taken before your Stripe account was connected. These are settled by hand every Tuesday; anything since goes straight to Stripe."
              : "Your subscribers pay Blitz.tips and we pass your share on every Tuesday. Connect Stripe to be paid automatically instead."}
          </p>
        </div>
      </div>

      {/* The outstanding figure, promoted out of the stats row and given the
          date it lands on. It is the one number on this page someone is
          actually waiting for. */}
      <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-xs uppercase tracking-wide text-muted">
            {due ? "Next payment" : "Nothing due"}
          </p>
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
            <CalendarClock className="h-3.5 w-3.5" />
            {today ? "Today" : formatDateWithWeekday(payday)}
          </p>
        </div>
        <p
          className={`mt-1 font-display text-3xl font-bold tabular-nums ${
            due ? "text-accent" : "text-muted"
          }`}
        >
          {formatCents(due ? balance.outstandingCents : 0, currency)}
        </p>
        <p className="mt-1 text-xs text-muted">
          {!due
            ? "Everything you have earned so far has been sent. New subscriptions land here."
            : today
              ? "Going out in today's payout run."
              : "Sent by transfer on the next Tuesday payout run."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-4">
        <Figure label="This month" value={formatCents(balance.monthCents, currency)} />
        <Figure label="Last 30 days" value={formatCents(balance.last30Cents, currency)} />
        <Figure label="Earned in total" value={formatCents(balance.netCents, currency)} />
        <Figure label="Paid out" value={formatCents(balance.paidCents, currency)} />
      </div>

      <p className="text-xs text-muted">
        From {balance.count} {balance.count === 1 ? "payment" : "payments"}
        {balance.firstEarnedAt && ` since ${formatDate(balance.firstEarnedAt)}`}, after the
        platform commission on your plan.
        {balance.lastPaidAt && ` Last transfer ${formatDate(balance.lastPaidAt)}.`}
      </p>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 font-display text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
