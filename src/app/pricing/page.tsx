import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { PLATFORM_FEE_PERCENT } from "@/lib/stripe";

export const metadata: Metadata = { title: "Become a Handicapper" };

const perks = [
  "A public profile with your full, unedited win/loss record",
  "Automatic units, win rate, and ROI tracking on every pick",
  "Direct monthly subscriptions billed through Stripe",
  "You set your own price — change it any time",
  "Payouts land in your bank account via Stripe Connect",
];

export default function PricingPage() {
  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-bold">Turn your picks into income</h1>
        <p className="mt-4 text-muted">
          Blitz.tips handles subscriptions, billing, and record-keeping so you can focus on
          finding winners. We take a flat {PLATFORM_FEE_PERCENT}% platform fee — you keep the rest.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
        <div className="card p-8">
          <h2 className="text-lg font-semibold">What you get</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {perks.map((perk) => (
              <li key={perk} className="flex items-start gap-2 text-sm text-muted">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                {perk}
              </li>
            ))}
          </ul>
        </div>

        <div className="card flex flex-col justify-between p-8">
          <div>
            <h2 className="text-lg font-semibold">Revenue split</h2>
            <div className="mt-4 flex items-end gap-2">
              <span className="text-4xl font-bold text-accent">{100 - PLATFORM_FEE_PERCENT}%</span>
              <span className="mb-1 text-sm text-muted">goes to you, on every subscription</span>
            </div>
            <p className="mt-4 text-sm text-muted">
              No setup fees, no monthly minimums. You only pay the platform fee on revenue you
              actually collect.
            </p>
          </div>
          <Link
            href="/dashboard/handicapper"
            className="mt-8 block rounded-lg bg-accent py-3 text-center text-sm font-semibold text-accent-foreground hover:opacity-90"
          >
            Set up your profile
          </Link>
        </div>
      </div>
    </div>
  );
}
