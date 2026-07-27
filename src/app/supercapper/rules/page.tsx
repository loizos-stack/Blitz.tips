import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, ScrollText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { contestRuleItems } from "@/lib/contest-rules";
import { effectivePrizeLadderCents, activeEntrantCount } from "@/lib/contest";
import { formatCents } from "@/lib/utils";
import { SupercapperLogo } from "@/components/contest/supercapper-logo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contest rules",
  description:
    "The full rules of the Supercapper handicapping contest — entry, pick limits, grading, ranking and payouts.",
  alternates: { canonical: "/supercapper/rules" },
};

// The same list the entry modal shows, rendered as a page anyone can read
// without starting to enter — and link to, which the modal can't be.
export default async function ContestRulesPage() {
  const contest = await prisma.contest.findUnique({
    where: { slug: "supercapper" },
    include: { entries: { select: { disqualifiedAt: true } } },
  });
  if (!contest) {
    return (
      <div className="container-page py-16 text-center text-muted">Contest rules aren&apos;t available.</div>
    );
  }

  const prizeLadder = effectivePrizeLadderCents(contest, activeEntrantCount(contest.entries));
  const items = contestRuleItems({
    name: contest.name,
    minPicks: contest.minPicks,
    winners: prizeLadder.length,
    prizeLabel: formatCents(contest.prizePoolCents),
    dateRange: `${format(contest.startsAt, "MMM d, yyyy")} – ${format(contest.endsAt, "MMM d, yyyy")}`,
    registrationCloses: format(contest.registrationClosesAt ?? contest.endsAt, "MMM d, yyyy"),
    dynamicPayouts: contest.dynamicPayouts,
  });

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
          <ScrollText className="h-7 w-7 text-accent" /> Contest rules
        </h1>
        <p className="mt-2 text-muted">
          These are the rules every entrant accepts before entering. They apply for the whole
          contest, {format(contest.startsAt, "MMM d, yyyy")} – {format(contest.endsAt, "MMM d, yyyy")}.
        </p>

        <ol className="mt-8 flex flex-col gap-4">
          {items.map((item, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-raised text-xs font-bold text-muted">
                {i + 1}
              </span>
              <span className="text-sm leading-relaxed">{item}</span>
            </li>
          ))}
        </ol>

        <p className="mt-8 text-sm text-muted">
          Entering also means accepting our{" "}
          <Link href="/terms" className="text-accent hover:underline">
            Terms &amp; Conditions
          </Link>
          . Still unsure about something?{" "}
          <Link href="/supercapper/faq" className="text-accent hover:underline">
            Read the contest FAQ
          </Link>{" "}
          or{" "}
          <Link href="/contact?category=Contests" className="text-accent hover:underline">
            ask us
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
