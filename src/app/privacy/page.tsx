import type { Metadata } from "next";
import { LegalShell, Section, Bullets } from "@/components/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Blitz.tips collects, uses, and protects your personal information.",
};

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      updated="July 10, 2026"
      intro="This Privacy Policy explains what information Blitz.tips collects, how we use it, and the choices you have. By using Blitz.tips you agree to the practices described here."
    >
      <Section title="Information we collect">
        <Bullets
          items={[
            <><strong>Account information</strong> — your name, email address, and password (stored only as a secure hash). If you sign in with Google, we receive your basic profile and email from Google.</>,
            <><strong>Handicapper profile</strong> — the display name, handle, bio, images, pricing, and picks you choose to publish.</>,
            <><strong>Payment information</strong> — card subscriptions and payouts are handled by Stripe. We never see or store full card numbers; Stripe provides us only limited data such as the last four digits, status, and subscription identifiers. Crypto payments are handled by NOWPayments: we store order identifiers, amounts, and payment status, but never your wallet&rsquo;s private keys. Note that blockchain transactions are public by nature.</>,
            <><strong>Usage data</strong> — basic technical information such as pages viewed, device and browser type, and IP address, used to keep the service secure and reliable.</>,
          ]}
        />
      </Section>

      <Section title="How we use your information">
        <Bullets
          items={[
            "Provide and operate the service — accounts, picks, subscriptions, and payouts.",
            "Process payments and prevent fraud through our payment processor.",
            "Send transactional email such as email verification, receipts, and important account notices.",
            "Send product updates or announcements (you can opt out of non-essential email).",
            "Maintain the integrity of handicapper records and enforce our Terms.",
          ]}
        />
      </Section>

      <Section title="Service providers we share data with">
        <p>
          We do not sell your personal information. We share data only with vendors that help us run the
          service, under their own privacy and security commitments:
        </p>
        <Bullets
          items={[
            <><strong>Stripe</strong> — card payment processing, subscriptions, and handicapper payouts.</>,
            <><strong>NOWPayments</strong> — cryptocurrency payment processing for access passes.</>,
            <><strong>Resend</strong> — delivery of transactional and account email.</>,
            <><strong>Hosting &amp; database providers</strong> — to host the application and store your data securely.</>,
            "Law enforcement or regulators where required by law, or to protect the rights and safety of our users.",
          ]}
        />
      </Section>

      <Section title="Cookies">
        <p>
          We use essential cookies to keep you signed in and to secure your session. We do not use them to
          track you across other websites. You can clear or block cookies in your browser, but the site may
          not function correctly without the essential ones.
        </p>
      </Section>

      <Section title="Data retention">
        <p>
          We keep your account data for as long as your account is active. Published picks and their results
          may be retained to preserve the integrity of public track records even after an account is closed.
          You can request deletion of your account as described below.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          Depending on where you live, you may have the right to access, correct, export, or delete your
          personal information, and to object to certain processing. To exercise any of these, email us at{" "}
          <a href="mailto:support@blitz.tips" className="text-accent hover:underline">support@blitz.tips</a>{" "}
          and we will respond within a reasonable time.
        </p>
      </Section>

      <Section title="Children">
        <p>
          Blitz.tips is intended only for adults of legal gambling age in their jurisdiction. It is not
          directed to anyone under 18, and we do not knowingly collect information from minors.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          We may update this policy from time to time. When we do, we&rsquo;ll revise the &ldquo;Last
          updated&rdquo; date above, and significant changes may be highlighted in the app.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about privacy? Email{" "}
          <a href="mailto:support@blitz.tips" className="text-accent hover:underline">support@blitz.tips</a>.
        </p>
      </Section>
    </LegalShell>
  );
}
