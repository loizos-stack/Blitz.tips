import Link from "next/link";
import { Wallet } from "lucide-react";
import { formatCents } from "@/lib/utils";
import type { HandicapperBalance } from "@/lib/handicapper-balance";
import type { PriceCurrency } from "@prisma/client";

/**
 * What a handicapper who hasn't connected Stripe is owed.
 *
 * Shown because the alternative is worse: without it, someone selling
 * subscriptions through the platform's own Stripe account sees money leave
 * their subscribers and nothing anywhere saying it is theirs. A balance they
 * cannot see is a balance they have to ask about.
 *
 * It states the arrangement plainly rather than implying automatic payouts —
 * these transfers are sent by hand, and saying so sets the right expectation
 * about timing.
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

  return (
    <div className="card space-y-3 p-5">
      <div className="flex items-start gap-2">
        <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <div>
          <h2 className="font-semibold">Paid to you by Blitz.tips</h2>
          <p className="mt-1 text-sm text-muted">
            {connected
              ? "Subscriptions taken before your Stripe account was connected. These are settled by hand; anything since goes straight to Stripe."
              : "Your subscribers pay Blitz.tips and we pass your share on by transfer. Connect Stripe to be paid automatically instead."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 border-t border-border pt-3 text-center">
        <Figure label="Earned" value={formatCents(balance.netCents, currency)} />
        <Figure label="Sent" value={formatCents(balance.paidCents, currency)} />
        <Figure
          label="Outstanding"
          value={formatCents(balance.outstandingCents, currency)}
          tone={balance.outstandingCents > 0 ? "accent" : undefined}
        />
      </div>

      <p className="text-xs text-muted">
        From {balance.count} {balance.count === 1 ? "payment" : "payments"}, after the platform
        commission on your plan.{" "}
        {!connected && (
          <Link href="/dashboard/handicapper/payouts" className="text-accent hover:underline">
            Connecting Stripe
          </Link>
        )}
        {!connected && " removes the wait."}
      </p>
    </div>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "accent";
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p
        className={`mt-0.5 font-display text-lg font-bold tabular-nums ${
          tone === "accent" ? "text-accent" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
