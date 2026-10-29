import Link from "next/link";
import { Suspense } from "react";
import { ContestPromoStrip } from "@/components/cross-promo-strip";
import { ShieldCheck, LineChart, Users, ArrowRight } from "lucide-react";
import {
  listHandicapperDirectory,
  applyHandicapperFinder,
  splitByActivity,
  ACTIVE_WITHIN_DAYS,
} from "@/lib/handicappers";
import { HandicapperCard } from "@/components/handicapper-card";
import { HandicapperFinder } from "@/components/handicapper-finder";
import { HandicapperReveal } from "@/components/handicapper-reveal";
import { HomeBoard, HomeBoardSkeleton } from "@/components/home-board";
import type { Metadata } from "next";
import type { PickSport } from "@prisma/client";

// Every ?sport= / ?find= / ?q= permutation of the board and the handicapper
// finder is the same page with a filter applied, so they all point back here.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// `export const dynamic = "force-dynamic"` was removed here, and should not
// come back.
//
// This page renders <HomeBoard>, whose fetches are the site's only paid ones.
// Next's own docs say force-dynamic is equivalent to giving every fetch() in
// the segment `{ cache: 'no-store', next: { revalidate: 0 } }` — which would
// silently void every cache window in odds-api.ts and make each homepage view
// re-buy the whole board.
//
// Measured against 16.2.11, it does NOT currently do that: a cold render cost
// 39 upstream requests with the directive and 39 without, and five further
// renders cost nothing either way. So this is not a bug fix; it is removing a
// documented foot-gun that happens to be dormant. Depending on undocumented
// behaviour to keep the odds bill down is not a position worth being in.
//
// Nothing about the page changes: it reads searchParams, so it renders per
// request regardless. The directive bought nothing.

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string; find?: string; q?: string }>;
}) {
  const params = await searchParams;
  // Only the directory is awaited here. The odds board — the one slow,
  // third-party-dependent thing on this page — streams in separately below.
  const handicappers = await listHandicapperDirectory();

  // The "Find a Handicapper" finder: sport chips are the major sports offered by
  // at least one handicapper; the list is filtered/sorted by the active chip.
  const MAJOR_SPORTS: PickSport[] = ["NFL", "NBA", "MLB", "NHL", "SOCCER", "NCAAF", "NCAAB"];
  const offered = new Set(handicappers.flatMap((h) => h.sports));
  const finderSports = MAJOR_SPORTS.filter((s) => offered.has(s));
  const activeFilter = params.find ?? "all";
  const query = params.q ?? "";
  const foundHandicappers = applyHandicapperFinder(handicappers, activeFilter, query);

  // Handicappers who have gone quiet are held behind a "Load more" button, so
  // the directory leads with people actually posting. The split runs after the
  // finder, so it applies to whatever the current filter or search matched.
  const { active: activeHandicappers, dormant: dormantHandicappers } =
    splitByActivity(foundHandicappers);

  const totalPicks = handicappers.reduce((sum, h) => sum + h.stats.totalPicks, 0);

  return (
    <div>
      <section className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[url('/hero-bg.svg')] bg-cover bg-bottom"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background via-background/55 to-transparent"
        />
        <div className="container-page relative pb-20 pt-10 md:pb-28 md:pt-14">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
              Every pick. Every result. No cherry-picking.
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              Follow sports handicappers with a{" "}
              <span className="text-accent">verified track record.</span>
            </h1>
            <p className="mt-6 text-lg text-muted">
              Blitz.tips is a marketplace where handicappers post every pick before it happens.
              We track wins, losses, units, and ROI automatically — so you can subscribe to cappers
              who actually beat the closing line, not just the ones who talk about it.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/leaderboard"
                className="flex items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:opacity-90"
              >
                See the leaderboard <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/signup"
                className="flex items-center justify-center rounded-lg border border-border px-6 py-3 text-sm font-semibold hover:border-muted"
              >
                Buy or Sell tips
              </Link>
            </div>
          </div>

          <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat
              label={handicappers.length === 1 ? "Handicapper" : "Handicappers"}
              value={handicappers.length.toString()}
            />
            <Stat label="Picks tracked" value={totalPicks.toString()} />
            <Stat label="Verified records" value="100%" />
            <Stat label="Platform fee" value="Transparent" />
          </div>
        </div>
      </section>

      <ContestPromoStrip />

      <div id="lines" />
      <Suspense fallback={<HomeBoardSkeleton />}>
        <HomeBoard sportParam={params.sport} />
      </Suspense>

      <section id="find" className="relative scroll-mt-20 overflow-hidden border-y border-border py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[url('/lines-bg.svg')] bg-cover bg-center opacity-[0.07]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/[0.07] via-transparent to-gold/[0.07]"
        />
        <div className="container-page relative">
        <div className="mb-2 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold">Find a Handicapper</h2>
            <p className="mt-1 text-muted">Search and filter by what matters to you.</p>
          </div>
          <Link href="/leaderboard" className="hidden text-sm font-medium text-accent hover:underline sm:block">
            Full leaderboard →
          </Link>
        </div>

        <HandicapperFinder sports={finderSports} activeFilter={activeFilter} query={query} />

        {handicappers.length === 0 ? (
          <div className="card mt-8 p-8 text-center text-muted">
            No handicappers yet — be the first to build a public track record.
          </div>
        ) : foundHandicappers.length === 0 ? (
          <div className="card mt-8 p-8 text-center text-muted">
            No handicappers match your search. Try a different filter.
          </div>
        ) : (
          <HandicapperReveal
            shownCount={activeHandicappers.length}
            hiddenCount={dormantHandicappers.length}
            days={ACTIVE_WITHIN_DAYS}
            empty={
              <div className="card mt-8 p-8 text-center text-muted">
                {activeFilter === "all" && query === ""
                  ? `No handicapper has posted a pick in the last ${ACTIVE_WITHIN_DAYS} days.`
                  : `Nothing matching this has been posted in the last ${ACTIVE_WITHIN_DAYS} days.`}
              </div>
            }
            hidden={dormantHandicappers.map((h) => (
              <HandicapperCard key={h.id} handicapper={h} />
            ))}
          >
            {activeHandicappers.map((h) => (
              <HandicapperCard key={h.id} handicapper={h} />
            ))}
          </HandicapperReveal>
        )}
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-border bg-surface/40 py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[url('/lines-bg.svg')] bg-cover bg-center opacity-[0.07]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/[0.07] via-transparent to-gold/[0.07]"
        />
        <div className="container-page relative">
          <h2 className="text-2xl font-bold">How Blitz.tips works</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <HowItWorksCard
              icon={<LineChart className="h-5 w-5" />}
              title="Every pick is timestamped"
              description="Handicappers post picks before the event starts. Results are settled after, so records can't be edited after the fact."
            />
            <HowItWorksCard
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Stats you can trust"
              description="Win rate, units, and ROI are computed automatically from every pick — wins and losses alike."
            />
            <HowItWorksCard
              icon={<Users className="h-5 w-5" />}
              title="Subscribe directly"
              description="Pay a handicapper's monthly price to unlock their premium picks. Cancel any time, no middlemen."
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xl font-bold tabular-nums md:text-3xl">{value}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  );
}

function HowItWorksCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    // Icon and heading share a row rather than stacking: it saves a whole line
    // of height per card and reads as one label instead of two.
    <div className="card p-5">
      {/* items-start keeps every icon in a row at the same height even when one
          card's heading wraps to two lines; min-h-9 on the heading keeps a
          single-line one optically centred against the icon. */}
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
          {icon}
        </span>
        <h3 className="flex min-h-9 min-w-0 items-center text-sm font-semibold">{title}</h3>
      </div>
      <p className="mt-3 text-sm text-muted">{description}</p>
    </div>
  );
}
