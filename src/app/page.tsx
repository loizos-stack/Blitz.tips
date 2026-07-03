import Link from "next/link";
import { ShieldCheck, LineChart, Users, ArrowRight } from "lucide-react";
import { listHandicapperSummaries } from "@/lib/handicappers";
import { HandicapperCard } from "@/components/handicapper-card";
import { UpcomingGames } from "@/components/upcoming-games";
import { getUpcomingEvents, getAvailableHomepageSports } from "@/lib/odds-api";
import type { PickSport } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string }>;
}) {
  const params = await searchParams;
  const [handicappers, availableSports] = await Promise.all([
    listHandicapperSummaries(),
    getAvailableHomepageSports(),
  ]);

  // availableSports is only empty when THE_ODDS_API_KEY is unset, in which
  // case UpcomingGames bails out before this value is ever used — the "NFL"
  // fallback just satisfies the type.
  const sport: PickSport = availableSports.includes(params.sport as PickSport)
    ? (params.sport as PickSport)
    : (availableSports[0] ?? "NFL");

  const oddsFeed = await getUpcomingEvents(sport);
  const featured = [...handicappers]
    .sort((a, b) => b.stats.unitsNet - a.stats.unitsNet)
    .slice(0, 3);

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
        <div className="container-page relative py-20 md:py-28">
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
                href="/pricing"
                className="flex items-center justify-center rounded-lg border border-border px-6 py-3 text-sm font-semibold hover:border-muted"
              >
                Become a handicapper
              </Link>
            </div>
          </div>

          <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Handicappers" value={handicappers.length.toString()} />
            <Stat label="Picks tracked" value={totalPicks.toString()} />
            <Stat label="Verified records" value="100%" />
            <Stat label="Platform fee" value="Transparent" />
          </div>
        </div>
      </section>

      <div id="lines" />
      <UpcomingGames sport={sport} feed={oddsFeed} availableSports={availableSports} />

      <section className="container-page py-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold">Top performers</h2>
            <p className="mt-1 text-muted">Ranked by net units over their full tracked history.</p>
          </div>
          <Link href="/leaderboard" className="hidden text-sm font-medium text-accent hover:underline sm:block">
            Full leaderboard →
          </Link>
        </div>

        {featured.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((h, i) => (
              <HandicapperCard key={h.id} handicapper={h} rank={i + 1} />
            ))}
          </div>
        ) : (
          <div className="card p-8 text-center text-muted">
            No handicappers yet — be the first to build a public track record.
          </div>
        )}
      </section>

      <section className="border-t border-border bg-surface/40 py-16">
        <div className="container-page">
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
    <div className="card p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent">{icon}</div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted">{description}</p>
    </div>
  );
}
