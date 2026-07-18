import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { ContactForm } from "@/components/contact-form";
import { FaqJsonLd } from "@/components/json-ld";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers to common questions about following handicappers and selling picks on Blitz.tips.",
  alternates: { canonical: "/faq" },
};

interface QA {
  q: string;
  a: React.ReactNode;
}

const BETTORS: QA[] = [
  {
    q: "What is Blitz.tips?",
    a: "Blitz.tips is a marketplace where sports handicappers publish their picks and build a public, verified track record. You can browse the leaderboard, compare records, and subscribe to the handicappers you trust.",
  },
  {
    q: "How are records verified?",
    a: "Every pick is timestamped the moment it's posted — before the event starts — and graded automatically or by the handicapper from the final result. Nobody can edit a pick after kickoff or delete a loss, so the win/loss record you see is the real one.",
  },
  {
    q: "What do “units” and “ROI” mean?",
    a: "A unit is a handicapper's standard bet size, so records stay comparable no matter how big anyone actually wagers. Units won is total profit measured in those units; ROI is that profit divided by total units risked. Higher and steadier is better.",
  },
  {
    q: "How do subscriptions work?",
    a: "Each handicapper sets their own weekly, monthly, and/or annual price. You subscribe through secure Stripe checkout and instantly unlock their premium picks in your feed. Subscriptions renew automatically until you cancel.",
  },
  {
    q: "Can I cancel any time?",
    a: "Yes. Manage or cancel any subscription from your dashboard in a couple of clicks. You keep access until the end of the period you've already paid for.",
  },
  {
    q: "Which sports are covered?",
    a: "NFL, NBA, WNBA, MLB, NHL, college football and basketball, soccer, golf, tennis, UFC/MMA and more — it depends on what each handicapper covers.",
  },
  {
    q: "Are picks guaranteed to win?",
    a: "No. Sports betting always carries risk and no handicapper wins every time. Blitz.tips makes past performance transparent so you can make informed choices, but nothing here is a guarantee of future results.",
  },
  {
    q: "Can I pay with crypto?",
    a: "Yes, when the handicapper has crypto enabled you'll see a “Pay with crypto” button on their subscribe card. It buys a one-time access pass for a fixed length — 7 days (weekly), 30 days (monthly), or 365 days (annual) — at the same package price as card checkout.",
  },
  {
    q: "How does paying with crypto work?",
    a: "Tap “Pay with crypto” and you're taken to a secure hosted checkout (powered by NOWPayments). Choose your coin — BTC, ETH, USDC and 300+ others — and send the amount shown. Once the payment confirms on-chain, your access to that handicapper's premium picks unlocks automatically. Prices are set in the handicapper's currency and converted to crypto at checkout.",
  },
  {
    q: "Does a crypto payment auto-renew?",
    a: "No. Unlike a card subscription, a crypto pass is a single payment for a fixed period and does not renew on its own. When it's about to expire, just pay again to extend — paying again while a pass is still active adds the new days on top of your current end date.",
  },
  {
    q: "Crypto vs card — is there any difference in what I get?",
    a: "None in access — both unlock the same premium picks. Card subscriptions renew automatically and can offer a short free trial; crypto is a one-time pass with no trial and no auto-renew. Crypto also works even if a handicapper hasn't set up card payments yet.",
  },
];

const HANDICAPPERS: QA[] = [
  {
    q: "How do I become a handicapper?",
    a: (
      <>
        Create an account, then open the{" "}
        <Link href="/dashboard/handicapper" className="text-accent hover:underline">
          handicapper dashboard
        </Link>{" "}
        to set up your public profile, pricing, and start posting picks. It&rsquo;s free to begin.
      </>
    ),
  },
  {
    q: "How much does it cost, and how much do I keep?",
    a: (
      <>
        Starting is free. Your plan sets your commission: Free keeps 80% of every subscription, Silver
        85%, and Gold 90% (Gold is also featured across the site). See{" "}
        <Link href="/pricing" className="text-accent hover:underline">
          the plans
        </Link>{" "}
        for details.
      </>
    ),
  },
  {
    q: "How and when do I get paid?",
    a: "Subscriber payments are processed through Stripe Connect and paid out to your connected bank account on Stripe's standard payout schedule, minus the platform commission for your plan.",
  },
  {
    q: "How do crypto payouts work for handicappers?",
    a: (
      <>
        Add your payout wallet addresses in the{" "}
        <Link href="/dashboard/handicapper/payouts" className="text-accent hover:underline">
          Payouts tab
        </Link>{" "}
        of your dashboard — an ETH (ERC-20) and/or a BTC address. When a subscriber pays you in crypto,
        your share (the package price minus your plan&rsquo;s commission) is sent to that wallet on our
        regular payout schedule. Your wallet addresses are private and never shown on your profile.
      </>
    ),
  },
  {
    q: "Do I need to set up Stripe to accept crypto?",
    a: "No. Crypto works independently of Stripe — as long as you've added a payout wallet, subscribers can pay you in crypto even if you haven't started or finished Stripe onboarding. Setting up Stripe as well simply lets card-paying subscribers check out too.",
  },
  {
    q: "Which coins can subscribers pay me with?",
    a: "Subscribers pay on a hosted checkout that accepts BTC, ETH, USDC and 300+ other coins. You're paid out to the ETH and/or BTC wallet you set, so you receive it in the currency of the address you provide.",
  },
  {
    q: "Can I edit or delete a pick after posting?",
    a: "You can add analysis, but the core of a pick (selection, odds, and time) locks at post time to keep records honest. You grade the result once the game ends. Manipulating records is grounds for removal.",
  },
  {
    q: "How do I set my prices?",
    a: "From your dashboard you can offer weekly, monthly, and annual packages at prices you choose. Changes apply to new subscribers; existing subscribers keep their current rate until they resubscribe.",
  },
];

function FaqItem({ item }: { item: QA }) {
  return (
    <details className="group card p-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium">
        {item.q}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-5 pb-5 text-sm leading-relaxed text-muted">{item.a}</div>
    </details>
  );
}

// Only string answers go into the FAQ structured data (some rich answers are JSX).
const FAQ_JSONLD = [...BETTORS, ...HANDICAPPERS]
  .filter((it): it is { q: string; a: string } => typeof it.a === "string")
  .map((it) => ({ question: it.q, answer: it.a }));

export default function FaqPage() {
  return (
    <div className="container-page py-16">
      <FaqJsonLd items={FAQ_JSONLD} />
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold">Frequently asked questions</h1>
        <p className="mt-4 text-muted">
          Everything you need to know about following picks and selling them on Blitz.tips. Still stuck?
          Email{" "}
          <a href="mailto:support@blitz.tips" className="text-accent hover:underline">
            support@blitz.tips
          </a>
          .
        </p>

        <h2 className="mb-3 mt-12 text-xl font-bold">For bettors</h2>
        <div className="space-y-3">
          {BETTORS.map((item) => (
            <FaqItem key={item.q} item={item} />
          ))}
        </div>

        <h2 className="mb-3 mt-10 text-xl font-bold">For handicappers</h2>
        <div className="space-y-3">
          {HANDICAPPERS.map((item) => (
            <FaqItem key={item.q} item={item} />
          ))}
        </div>

        <div className="mt-12">
          <h2 className="text-xl font-bold">Still have questions?</h2>
          <p className="mt-2 text-sm text-muted">
            Didn&rsquo;t find your answer? Send us a message and we&rsquo;ll help — or email{" "}
            <a href="mailto:support@blitz.tips" className="text-accent hover:underline">support@blitz.tips</a>.
          </p>
          <div className="mt-5">
            <ContactForm />
          </div>
        </div>
      </div>
    </div>
  );
}
