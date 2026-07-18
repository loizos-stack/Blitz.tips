import type { Metadata } from "next";
import Link from "next/link";
import { Check, ShieldCheck, Wallet, LineChart, Tags, Trophy, Layers } from "lucide-react";
import { PLAN_DEFINITIONS } from "@/lib/plans";
import { formatCents, cn } from "@/lib/utils";
import type { HandicapperPlan } from "@prisma/client";

export const metadata: Metadata = {
  title: "Sell Tips",
  description:
    "Sell your sports tips on Blitz.tips. Build a verified track record, set your own prices, and get paid by card or crypto while we handle billing and payouts.",
  alternates: { canonical: "/pricing" },
};

const PLAN_ORDER: HandicapperPlan[] = ["FREE", "SILVER", "GOLD"];

const BENEFITS = [
  {
    icon: ShieldCheck,
    title: "A track record buyers trust",
    body: "Every pick is timestamped before the event and graded automatically. Your record can't be edited after the fact — which is exactly why subscribers believe it.",
  },
  {
    icon: Wallet,
    title: "Card and crypto payments",
    body: "Subscribers pay weekly, monthly, or annually — by card through Stripe or in crypto (BTC, ETH, USDC and 300+ coins). Card money lands in your bank on its own; crypto earnings are tracked on the platform and paid out to you.",
  },
  {
    icon: Tags,
    title: "You set the prices",
    body: "Name your own weekly, monthly, and annual prices, and change them any time from your dashboard. You keep the lion's share on every plan.",
  },
  {
    icon: LineChart,
    title: "Stats that sell for you",
    body: "Win rate, units, ROI, L10 form, and streaks are computed for you and shown on your profile, cards, and the leaderboard — no spreadsheets required.",
  },
  {
    icon: Layers,
    title: "Tools to post fast",
    body: "Build picks straight from the live odds feed, post multi-leg parlays, or upload a bet-slip image and let OCR read the legs for you.",
  },
  {
    icon: Trophy,
    title: "Get discovered",
    body: "Climb the public leaderboard, earn featured placement on paid plans, and let new subscribers find you by sport and recent form.",
  },
];

const STEPS = [
  {
    title: "Create your handicapper profile",
    body: "Sign up (or flip your existing account), pick your sports, add a bio, socials, and profile art.",
  },
  {
    title: "Post picks before they start",
    body: "Every pick is locked in with a timestamp. Mark premium picks to keep them behind your paywall.",
  },
  {
    title: "We grade and track everything",
    body: "Results settle automatically and your record, units, and ROI update across the site.",
  },
  {
    title: "Get paid every month",
    body: "Subscribers pay your prices by card or crypto; Stripe deposits card earnings automatically and crypto earnings are paid out to you.",
  },
];

export default function PricingPage() {
  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[url('/auth-bg.svg')] bg-cover bg-center"
      />
      <div className="container-page relative py-16">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
            For handicappers
          </span>
          <h1 className="mt-6 text-4xl font-bold">Sell your tips. Get paid to be right.</h1>
          <p className="mt-4 text-muted">
            Blitz.tips is a marketplace for handicappers with a real, verified record. We handle
            subscriptions, billing, and record-keeping so you can focus on finding winners — and
            build a following that pays you every month.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/signup?as=handicapper"
              className="flex items-center justify-center rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:opacity-90"
            >
              Start selling tips
            </Link>
            <Link
              href="/leaderboard"
              className="flex items-center justify-center rounded-lg border border-border px-6 py-3 text-sm font-semibold hover:border-muted"
            >
              See the leaderboard
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-5xl">
          <h2 className="text-center text-2xl font-bold">Why sell on Blitz.tips</h2>
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
          <h2 className="text-2xl font-bold">Pick a plan</h2>
          <p className="mt-3 text-muted">
            The lower your commission, the more you keep on every subscription. Start free and
            upgrade whenever you&rsquo;re ready — you can change plans any time from your dashboard.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-3">
          {PLAN_ORDER.map((plan) => {
            const def = PLAN_DEFINITIONS[plan];
            return (
              <div
                key={plan}
                className={cn("card flex flex-col p-8", plan === "GOLD" && "border-gold/50 bg-gold/5")}
              >
                <div>
                  <p className="flex items-center gap-1.5 text-lg font-semibold">
                    {def.label}
                    {plan === "GOLD" && <span className="text-gold">★</span>}
                  </p>
                  <p className="mt-3 text-3xl font-bold">
                    {def.monthlyPriceCents ? formatCents(def.monthlyPriceCents) : "$0"}
                    <span className="text-sm font-normal text-muted">{def.monthlyPriceCents ? "/mo" : ""}</span>
                  </p>
                  {def.annualPriceCents && (
                    <p className="mt-1 text-xs text-muted">or {formatCents(def.annualPriceCents)}/yr</p>
                  )}
                  <p className="mt-4 text-sm font-medium text-accent">{def.commissionPercent}% commission</p>
                </div>

                <ul className="mt-6 flex flex-1 flex-col gap-3 text-[15px] leading-snug text-foreground">
                  {def.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                      {perk}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/signup?as=handicapper"
                  className={cn(
                    "mt-8 block rounded-lg py-3 text-center text-sm font-semibold hover:opacity-90",
                    plan === "GOLD" ? "bg-gold text-[#1a1204]" : "bg-accent text-accent-foreground"
                  )}
                >
                  Get started
                </Link>
              </div>
            );
          })}
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted">
          No setup fees and no monthly minimums on Free. Looking to follow cappers instead?{" "}
          <Link href="/buy-picks" className="text-accent hover:underline">
            Buy tips
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
