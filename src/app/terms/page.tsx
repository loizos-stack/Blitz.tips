import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell, Section, Bullets } from "@/components/legal";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "The terms that govern your use of Blitz.tips.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalShell
      title="Terms &amp; Conditions"
      updated="July 10, 2026"
      intro="These Terms & Conditions govern your access to and use of Blitz.tips. By creating an account or using the service, you agree to these terms. If you don't agree, please don't use Blitz.tips."
    >
      <Section title="1. Eligibility">
        <p>
          You must be at least 18 years old, or the legal age for gambling-related services in your
          jurisdiction, whichever is higher, and legally permitted to use a service like this where you live.
          You are responsible for complying with the laws that apply to you.
        </p>
      </Section>

      <Section title="2. What Blitz.tips is — and isn't">
        <p>
          Blitz.tips is an informational marketplace where independent handicappers publish sports betting
          picks and analysis, and users can subscribe to them. It is provided for informational and
          entertainment purposes only.
        </p>
        <Bullets
          items={[
            "We are not a sportsbook. We do not accept, place, or facilitate wagers, and we do not handle any betting funds.",
            "Picks are opinions, not financial or betting advice, and are never a guarantee of any outcome.",
            "You are solely responsible for any bets you choose to place and any resulting losses.",
          ]}
        />
      </Section>

      <Section title="3. Your account">
        <Bullets
          items={[
            "Provide accurate information and keep your login credentials secure.",
            "You are responsible for all activity that happens under your account.",
            "One person, one account. Don't impersonate others or create accounts to evade suspension.",
            "Notify us promptly of any unauthorized use.",
          ]}
        />
      </Section>

      <Section title="4. Handicapper terms">
        <p>If you publish picks as a handicapper, you additionally agree that:</p>
        <Bullets
          items={[
            "Your picks and records must be genuine. Fabricating, back-dating, or otherwise manipulating results is strictly prohibited and grounds for immediate removal.",
            "The core details of a pick lock at post time to preserve an honest track record.",
            "You set your own subscription prices; Blitz.tips retains a commission based on your plan. Card revenue is paid to your connected Stripe account automatically; crypto pass revenue is collected by Blitz.tips and your share (net of commission) is paid out to you by Blitz.tips.",
            "You are responsible for any taxes on income you earn, and for the accuracy of the payout details you provide.",
            "You will not post unlawful, misleading, or infringing content.",
          ]}
        />
      </Section>

      <Section title="5. Subscriptions and billing">
        <p>You can pay for handicapper subscriptions in two ways:</p>
        <Bullets
          items={[
            <><strong>Card (Stripe)</strong> — subscriptions renew automatically at the start of each period until cancelled.</>,
            <><strong>Cryptocurrency (via NOWPayments)</strong> — a one-time payment buys a fixed-length access pass (7 days, 30 days, or 1 year). Crypto passes never renew automatically; access simply ends when the pass expires unless you buy another. The USD price is converted to your chosen cryptocurrency at the exchange rate applied at checkout, and network fees are borne by the payer.</>,
          ]}
        />
        <p>
          Cryptocurrency transactions are recorded on public blockchains and are irreversible once
          broadcast. It is your responsibility to send the exact amount requested to the address shown
          before the payment window expires; underpaid or late payments may fail. Billing, cancellations,
          and refunds for both payment methods are governed by our{" "}
          <Link href="/refunds" className="text-accent hover:underline">Refund Policy</Link>, which forms
          part of these Terms.
        </p>
      </Section>

      <Section title="6. Acceptable use">
        <p>You agree not to:</p>
        <Bullets
          items={[
            "Break any applicable law or promote illegal activity.",
            "Scrape, copy, resell, or redistribute picks or other content without permission.",
            "Interfere with, attack, or attempt to gain unauthorized access to the service.",
            "Harass other users or post abusive, deceptive, or infringing material.",
          ]}
        />
      </Section>

      <Section title="7. Intellectual property">
        <p>
          The Blitz.tips name, logo, and platform are our property. Handicappers retain ownership of the
          content they post but grant Blitz.tips a license to host, display, and promote it in connection with
          operating the service.
        </p>
      </Section>

      <Section title="8. Disclaimers">
        <p>
          The service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any
          kind. We do not warrant that picks will be profitable, that the service will be uninterrupted or
          error-free, or that any information is complete or accurate.
        </p>
      </Section>

      <Section title="9. Limitation of liability">
        <p>
          To the maximum extent permitted by law, Blitz.tips and its team will not be liable for any indirect,
          incidental, or consequential damages, or for any betting losses, arising from your use of the
          service. Our total liability for any claim is limited to the amount you paid us in the three months
          before the claim.
        </p>
      </Section>

      <Section title="10. Indemnification">
        <p>
          You agree to indemnify and hold Blitz.tips harmless from claims arising out of your use of the
          service, your content, or your violation of these Terms or any law.
        </p>
      </Section>

      <Section title="11. Suspension and termination">
        <p>
          We may suspend or terminate accounts that violate these Terms or that we reasonably believe pose a
          risk to the platform or its users. You may close your account at any time.
        </p>
      </Section>

      <Section title="12. Changes and governing law">
        <p>
          We may update these Terms from time to time; continued use after changes take effect means you
          accept them. These Terms are governed by the laws of the jurisdiction in which Blitz.tips is
          established, without regard to conflict-of-law rules.
        </p>
      </Section>

      <Section title="13. Responsible gambling">
        <p>
          Please bet responsibly and only what you can afford to lose. If gambling stops being fun or feels
          out of control, help is available — in the US, call 1-800-GAMBLER.
        </p>
      </Section>

      <Section title="14. Contact">
        <p>
          Questions about these Terms? Email{" "}
          <a href="mailto:support@blitz.tips" className="text-accent hover:underline">support@blitz.tips</a>.
        </p>
      </Section>
    </LegalShell>
  );
}
