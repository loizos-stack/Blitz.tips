import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, LineChart, Lock, Search, CreditCard, Bell } from "lucide-react";

export const metadata: Metadata = {
  title: "Buy Tips",
  description:
    "Buy sports tips from verified handicappers on Blitz.tips — pay by card or crypto. Every pick is timestamped and graded, so you can subscribe to cappers with a real, provable track record.",
};

const BENEFITS = [
  {
    icon: ShieldCheck,
    title: "Verified, not cherry-picked",
    body: "Every pick is posted before the event and graded automatically. What you see is a capper's complete record — wins and losses — never a highlight reel.",
  },
  {
    icon: LineChart,
    title: "Compare on the numbers",
    body: "Rank handicappers by units, ROI, win rate, last-10 form, and current streak on the leaderboard, then filter by the sport you bet.",
  },
  {
    icon: Lock,
    title: "Premium picks, unlocked",
    body: "Subscribe to a capper to unlock their premium plays — matchup, selection, odds, units risked, and their analysis behind each one.",
  },
  {
    icon: CreditCard,
    title: "Pay by card or crypto",
    body: "Pay a capper's weekly, monthly, or annual price by card through secure Stripe checkout — cancel anytime — or with crypto (BTC, ETH, USDC and 300+ coins) for a one-time access pass that never auto-renews.",
  },
  {
    icon: Bell,
    title: "One feed for everyone you follow",
    body: "Your dashboard collects upcoming and recent picks from every handicapper you subscribe to, plus their combined record and units.",
  },
  {
    icon: Search,
    title: "Find your edge across sports",
    body: "From NFL and NBA to soccer, UFC, and more — browse specialists by sport and see who's actually beating the number lately.",
  },
];

const STEPS = [
  {
    title: "Browse the leaderboard",
    body: "See every handicapper ranked by their full, unedited track record.",
  },
  {
    title: "Check the receipts",
    body: "Open a profile to study units, ROI, L10 form, streaks, and past plays before you commit.",
  },
  {
    title: "Subscribe to your pick",
    body: "Choose weekly, monthly, or annual at the capper's price and pay by card or crypto.",
  },
  {
    title: "Get their picks",
    body: "Premium plays unlock instantly and land in your feed — follow along and track results.",
  },
];

export default function BuyPicksPage() {
  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[url('/auth-bg.svg')] bg-cover bg-center"
      />
      <div className="container-page relative py-16">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
            For bettors
          </span>
          <h1 className="mt-6 text-4xl font-bold">Buy tips from handicappers who prove it.</h1>
          <p className="mt-4 text-muted">
            Stop guessing which touts are legit. On Blitz.tips every pick is timestamped and graded,
            so you can subscribe to handicappers with a real, verifiable record — and see exactly
            what you&rsquo;re paying for before you pay.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/leaderboard"
              className="flex items-center justify-center rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:opacity-90"
            >
              Browse the leaderboard
            </Link>
            <Link
              href="/handicappers"
              className="flex items-center justify-center rounded-lg border border-border px-6 py-3 text-sm font-semibold hover:border-muted"
            >
              See all handicappers
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-5xl">
          <h2 className="text-center text-2xl font-bold">Why buy on Blitz.tips</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="card p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-5xl">
          <h2 className="text-center text-2xl font-bold">How it works</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <div key={step.title} className="card p-6">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-accent">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted">{step.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-2xl text-center">
          <h2 className="text-2xl font-bold">Ready to find your capper?</h2>
          <p className="mt-3 text-muted">
            Browse verified records and subscribe in a couple of clicks. Got a winning record of your
            own?{" "}
            <Link href="/pricing" className="text-accent hover:underline">
              Sell your tips
            </Link>{" "}
            instead.
          </p>
          <div className="mt-6">
            <Link
              href="/leaderboard"
              className="inline-flex items-center justify-center rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:opacity-90"
            >
              Browse the leaderboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
