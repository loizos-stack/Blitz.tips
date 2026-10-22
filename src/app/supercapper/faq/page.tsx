import type { Metadata } from "next";
import Link from "next/link";
import { formatDate } from "@/lib/date-format";
import { ArrowLeft, HelpCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/utils";
import { MAX_PICKS_PER_DAY, MAX_PICKS_PER_WEEK, MAX_UNITS_PER_DAY } from "@/lib/contest-limits";
import { MIN_PAYOUT_SPOTS, ENTRANTS_PER_EXTRA_SPOT } from "@/lib/contest";
import { SupercapperLogo } from "@/components/contest/supercapper-logo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contest FAQ",
  description:
    "Common questions about the Supercapper handicapping contest — entry, qualifying, scoring, payouts and grading.",
  alternates: { canonical: "/supercapper/faq" },
};

// Contest-specific FAQ. Separate from the site FAQ (/faq), which covers
// subscriptions and selling picks — mixing the two buries both.
export default async function ContestFaqPage() {
  const contest = await prisma.contest.findUnique({ where: { slug: "supercapper" } });
  const prize = contest ? formatCents(contest.prizePoolCents) : "the guaranteed pool";
  const minPicks = contest?.minPicks ?? 100;
  const dates = contest
    ? `${formatDate(contest.startsAt)} to ${formatDate(contest.endsAt)}`
    : "the published contest window";

  const faqs: { q: string; a: React.ReactNode }[] = [
    {
      q: "What does it cost to enter?",
      a: <>Nothing. It&apos;s free, there&apos;s no card required, and there&apos;s nothing to buy at any point.</>,
    },
    {
      q: "Who can enter?",
      a: (
        <>
          Any registered Blitz.tips user who is of legal age to take part where they live. One entry
          per person — multiple accounts are disqualified, and we check.
        </>
      ),
    },
    {
      q: "When does it run?",
      a: <>{dates}. Entries stay open during the contest, so you can join after it starts.</>,
    },
    {
      q: "Can I still join once it's underway?",
      a: (
        <>
          Yes, until registration closes. But you need {minPicks} graded picks to be eligible for a
          prize, so the later you start the harder that is to reach. Joining late is allowed, not
          advised.
        </>
      ),
    },
    {
      q: "How do I qualify for a prize?",
      a: (
        <>
          Post at least <strong>{minPicks} graded picks</strong>. Anyone can post picks from day one,
          but the leaderboard and the prize pool only count entrants who&apos;ve reached that number —
          it rewards a season of work rather than a hot week.
        </>
      ),
    },
    {
      q: "How is the winner decided?",
      a: (
        <>
          By <strong>volume-adjusted ROI</strong>, not units won. Your return on units risked, with a
          fixed block of break-even units added in, so a small sample can&apos;t top a full season. Going
          3-0 and stopping will not beat someone grinding hundreds of picks at a real edge.
        </>
      ),
    },
    {
      q: "How many places get paid?",
      a: (
        <>
          At least {MIN_PAYOUT_SPOTS}, plus one more for every {ENTRANTS_PER_EXTRA_SPOT} entrants who
          join — so 30 entrants pays 4 places. The full {prize} is paid out either way; a smaller
          field just means a bigger slice each.
        </>
      ),
    },
    {
      q: "Are there limits on how much I can post?",
      a: (
        <>
          Yes — up to {MAX_PICKS_PER_DAY} picks and {MAX_UNITS_PER_DAY} units a day, and{" "}
          {MAX_PICKS_PER_WEEK} picks a week. Daily quotas reset at midnight UTC, weekly on Monday.
          The caps stop anyone brute-forcing the leaderboard with volume alone.
        </>
      ),
    },
    {
      q: "Can I post parlays?",
      a: <>No — singles only. Every other market counts: moneylines, spreads, totals, alternate lines, halves, quarters, periods and player props.</>,
    },
    {
      q: "Where do the odds come from?",
      a: (
        <>
          The live Blitz.tips board. You can&apos;t type your own price. If the line moves between
          loading the board and submitting, the pick is rejected and you can take the new number —
          which is what stops anyone backdating a winner.
        </>
      ),
    },
    {
      q: "How are picks graded?",
      a: (
        <>
          Automatically from the odds feed&apos;s final scores, several times a day. Anything the feed
          can&apos;t settle is graded by hand. Grading is final.
        </>
      ),
    },
    {
      q: "Can I delete a pick I regret?",
      a: (
        <>
          No. Once it&apos;s in it&apos;s in, and it&apos;s timestamped. That&apos;s the whole point — a
          record you can delete from isn&apos;t a record.
        </>
      ),
    },
    {
      q: "Is my pick history public?",
      a: (
        <>
          Yes. Every entrant has a public page showing their picks, record and rank history, and the
          consensus page shows what the field is on. You appear under your username, which is why we
          ask you to choose one before entering.
        </>
      ),
    },
    {
      q: "How do I get paid if I win?",
      a: (
        <>
          We contact you after the contest settles and arrange payment. Prizes are forfeited if an
          entry is disqualified for multi-accounting, collusion or manipulation.
        </>
      ),
    },
    {
      q: "Do I need to be a handicapper selling picks?",
      a: (
        <>
          No. The contest is open to everyone with an account. If you do sell picks on Blitz.tips
          your contest picks are separate from your paid ones.
        </>
      ),
    },
  ];

  return (
    <div className="container-page py-12">
      <Link
        href="/supercapper"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Contest overview
      </Link>

      <div className="mx-auto mt-6 max-w-3xl">
        <SupercapperLogo withContest className="text-3xl" />
        <h1 className="mt-6 flex items-center gap-2 text-3xl font-bold">
          <HelpCircle className="h-7 w-7 text-accent" /> Contest FAQ
        </h1>
        <p className="mt-2 text-muted">
          Everything people ask before entering. For the binding version, read the{" "}
          <Link href="/supercapper/rules" className="text-accent hover:underline">
            full rules
          </Link>
          .
        </p>

        <div className="mt-8 flex flex-col gap-4">
          {faqs.map((faq) => (
            <div key={faq.q} className="card p-5">
              <h2 className="font-semibold">{faq.q}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{faq.a}</p>
            </div>
          ))}
        </div>

        <div className="card mt-8 border-accent/40 bg-accent/5 p-5">
          <p className="font-semibold">Still stuck?</p>
          <p className="mt-1 text-sm text-muted">
            Ask us directly — contest questions go straight to the right queue.
          </p>
          <Link
            href="/contact?category=Contests"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
          >
            Contact us
          </Link>
        </div>
      </div>
    </div>
  );
}
