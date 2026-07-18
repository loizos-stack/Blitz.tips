import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell, Section, Bullets } from "@/components/legal";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "How subscriptions, cancellations, and refunds work on Blitz.tips.",
  alternates: { canonical: "/refunds" },
};

export default function RefundsPage() {
  return (
    <LegalShell
      title="Refund Policy"
      updated="July 10, 2026"
      intro="This policy explains how billing, cancellations, and refunds work for card subscriptions, crypto access passes, and handicapper plans on Blitz.tips."
    >
      <Section title="Subscriptions to handicappers (card)">
        <p>
          When you subscribe to a handicapper with a card, you&rsquo;re charged immediately and then
          automatically at the start of each renewal period (weekly, monthly, or annual) until you cancel.
          Because premium picks are delivered instantly and time-sensitive, payments are generally
          non-refundable once the period has begun.
        </p>
      </Section>

      <Section title="Crypto access passes">
        <p>
          Paying with cryptocurrency buys a one-time, fixed-length access pass (7 days, 30 days, or 1
          year). Crypto passes never renew automatically — there is nothing to cancel, and access simply
          ends when the pass expires.
        </p>
        <Bullets
          items={[
            "Cryptocurrency transactions are irreversible on-chain, so crypto payments are final and generally non-refundable once your pass is activated.",
            "If a payment fails, expires, or is underpaid at checkout, no pass is granted — follow the payment provider's on-screen instructions, or contact us if funds left your wallet without a pass being activated.",
            "Where we approve a refund for a crypto purchase (per the criteria below), it is returned in cryptocurrency — typically a stablecoin — to a wallet address you provide, net of network fees. Exchange-rate movements between purchase and refund are not compensated.",
          ]}
        />
      </Section>

      <Section title="Cancelling vs. refunding">
        <Bullets
          items={[
            <><strong>Cancelling</strong> stops future renewals on card subscriptions. You keep access for the remainder of the period you&rsquo;ve already paid for, and you won&rsquo;t be charged again. You can cancel any time from your <Link href="/dashboard" className="text-accent hover:underline">dashboard</Link>. Crypto passes don&rsquo;t renew, so they never need cancelling.</>,
            <><strong>Refunding</strong> returns money already paid. This is handled case by case (see below) rather than automatically.</>,
          ]}
        />
      </Section>

      <Section title="When we may issue a refund">
        <p>We review refund requests in good faith and may grant one where, for example:</p>
        <Bullets
          items={[
            "You were charged in error or double-charged.",
            "A technical problem on our side prevented you from receiving the picks you paid for.",
            "A handicapper materially failed to deliver the picks their subscription promised.",
          ]}
        />
        <p>
          Refunds are not provided simply because picks lost — sports betting carries inherent risk and past
          results never guarantee future outcomes.
        </p>
      </Section>

      <Section title="How to request a refund">
        <p>
          Email{" "}
          <a href="mailto:support@blitz.tips" className="text-accent hover:underline">support@blitz.tips</a>{" "}
          within 14 days of the charge, including the email on your account and the approximate date and
          amount. Approved card refunds are returned to your original payment method via Stripe, typically
          within 5–10 business days. Approved crypto refunds are sent in cryptocurrency to a wallet address
          you provide, as described above.
        </p>
      </Section>

      <Section title="Handicapper platform plans">
        <p>
          Fees paid by handicappers for Silver or Gold plans follow the same principles: cancel any time to
          stop future billing, with access continuing until the end of the current period. Plan fees already
          paid are generally non-refundable except in the case of a billing error.
        </p>
      </Section>

      <Section title="Chargebacks">
        <p>
          If you have a billing concern, please contact us first — we can usually resolve it faster than your
          bank. Initiating a chargeback without contacting us may result in your account being suspended
          pending review.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about a charge or refund? Email{" "}
          <a href="mailto:support@blitz.tips" className="text-accent hover:underline">support@blitz.tips</a>.
        </p>
      </Section>
    </LegalShell>
  );
}
