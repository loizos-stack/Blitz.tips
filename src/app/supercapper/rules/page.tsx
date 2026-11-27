import type { Metadata } from "next";
import Link from "next/link";
import { formatDate } from "@/lib/date-format";
import { ArrowLeft, ScrollText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { contestRuleItems } from "@/lib/contest-rules";
import { effectivePrizeLadderCents, activeEntrantCount } from "@/lib/contest";
import { formatCents } from "@/lib/utils";
import { SupercapperLogo } from "@/components/contest/supercapper-logo";
import { supercapperVisible } from "@/lib/supercapper-visibility";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Metadata is resolved separately from the component, so the page's
 * notFound() does not suppress it: while the contest was hidden the
 * title, description and canonical for a $10,000 contest were still
 * being served in the payload of a 404.
 */
export async function generateMetadata(): Promise<Metadata> {
  if (!supercapperVisible()) return {};
  return {
  title: "Contest rules",
  description:
    "The full rules of the Supercapper handicapping contest — entry, pick limits, grading, ranking and payouts.",
  alternates: { canonical: "/supercapper/rules" },
};
}

// The same list the entry modal shows, rendered as a page anyone can read
// without starting to enter — and link to, which the modal can't be.
export default async function ContestRulesPage() {
  // The layout's gate returns the 404, but a layout and its page render
  // together: without this the page still ran and its whole output — title,
  // prize pool, standings, contest id — was serialised into the Flight payload
  // of a page that claims not to exist. Checked here so nothing renders.
  if (!supercapperVisible()) notFound();
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
    dateRange: `${formatDate(contest.startsAt)} – ${formatDate(contest.endsAt)}`,
    registrationCloses: formatDate(contest.registrationClosesAt ?? contest.endsAt),
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
          contest, {formatDate(contest.startsAt)} – {formatDate(contest.endsAt)}.
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
