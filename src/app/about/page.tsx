import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, LineChart, Users, Scale } from "lucide-react";

export const metadata: Metadata = {
  title: "About us",
  description:
    "Blitz.tips is a marketplace for verified sports handicappers — every pick timestamped, graded, and ranked so you can follow proven winners.",
};

const VALUES = [
  {
    icon: ShieldCheck,
    title: "Verified, not cherry-picked",
    body: "Every pick is timestamped before the game starts and graded from the final result. Records can't be edited after the fact — what you see is the real story.",
  },
  {
    icon: LineChart,
    title: "Sharp, transparent lines",
    body: "Odds come from major sportsbooks (Pinnacle first), so a capper's units and ROI reflect prices you could actually bet — no inflated numbers.",
  },
  {
    icon: Users,
    title: "Built for both sides",
    body: "Bettors get proven, rank-ordered handicappers. Handicappers get subscriptions, billing, and record-keeping handled — and keep up to 90% of revenue.",
  },
  {
    icon: Scale,
    title: "Fair and accountable",
    body: "Flat, honest pricing set by each handicapper. No lifetime lock-ins — subscribe or cancel any time, right from your dashboard.",
  },
];

const STEPS = [
  { n: "1", title: "Browse the leaderboard", body: "Filter handicappers by sport and sort by units won, win rate, or ROI over a verified history." },
  { n: "2", title: "Subscribe to your picks", body: "Pick a weekly, monthly, or annual plan from the handicappers you trust. Secure checkout via Stripe." },
  { n: "3", title: "Follow every play", body: "Get each pick in your feed the moment it's posted, and watch the running record update as games settle." },
];

export default function AboutPage() {
  return (
    <div>
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[url('/hero-bg.svg')] bg-cover bg-center opacity-70" />
        <div className="container-page relative py-20 text-center">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold sm:text-5xl">
            The marketplace for <span className="text-accent">verified</span> sports handicappers
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
            Blitz.tips exists to answer one question honestly: who is actually good at this? We track
            every pick, grade it from the real result, and rank handicappers on records they can&rsquo;t fake.
          </p>
        </div>
      </div>

      <div className="container-page py-16">
        {/* Mission */}
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold">Our mission</h2>
          <p className="mt-4 text-muted">
            The sports-picks world is full of screenshots, deleted losers, and &ldquo;5-0 last night&rdquo;
            claims that never add up. We built Blitz.tips to replace hype with proof. Handicappers publish
            their plays here, those plays are locked in before kickoff, and the results speak for themselves —
            wins and losses alike. Bettors finally get a straight answer, and the handicappers who genuinely
            win get the audience and income they&rsquo;ve earned.
          </p>
        </div>

        {/* Values */}
        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          {VALUES.map((v) => (
            <div key={v.title} className="card p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <v.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{v.title}</h3>
              <p className="mt-2 text-sm text-muted">{v.body}</p>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div className="mt-16">
          <h2 className="text-center text-2xl font-bold">How it works</h2>
          <div className="mx-auto mt-8 grid max-w-4xl gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="card p-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                  {s.n}
                </div>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-2xl border border-border bg-surface-raised p-10 text-center">
          <h2 className="text-2xl font-bold">Ready to bet smarter?</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted">
            Explore the leaderboard to find proven handicappers, or start building your own public track
            record today.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/leaderboard"
              className="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:opacity-90"
            >
              Browse the leaderboard
            </Link>
            <Link
              href="/pricing"
              className="rounded-lg border border-border px-6 py-3 text-sm font-semibold hover:border-muted"
            >
              Become a handicapper
            </Link>
          </div>
        </div>

        <p className="mx-auto mt-12 max-w-3xl text-center text-xs text-muted">
          Blitz.tips is a platform for informational and entertainment purposes only and does not accept
          wagers. You must be of legal age to gamble in your jurisdiction. If gambling stops being fun,
          call 1-800-GAMBLER for confidential help.
        </p>
      </div>
    </div>
  );
}
