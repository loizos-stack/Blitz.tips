import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeStats } from "@/lib/odds";
import { cumulativeUnits, formatUnits } from "@/lib/analytics";
import { formatCents } from "@/lib/utils";
import { PickCard } from "@/components/pick-card";
import { HandicapperCard } from "@/components/handicapper-card";
import { ManageBillingButton } from "@/components/manage-billing-button";
import { VerifyEmailBanner } from "@/components/verify-email-banner";
import { Avatar } from "@/components/avatar";
import { StatCard } from "@/components/stat-card";
import { UnitsChart } from "@/components/dashboard/units-chart";
import { listHandicapperSummariesByIds, sortPaidFirst } from "@/lib/handicappers";
import { enrichPickCrests } from "@/lib/pick-logos";
import { getSetting } from "@/lib/settings";
import { DASHBOARD_ORDER_SETTING, resolveSectionOrder } from "@/lib/dashboard-sections";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

// Data loading + wall-clock reads live outside the component so they don't trip
// the render-purity lint; a server component fetching per-request data is fine.
async function loadDashboard(userId: string) {
  const [currentUser, handicapperProfile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerified: true },
    }),
    prisma.handicapperProfile.findUnique({
      where: { userId },
      select: { id: true },
    }),
  ]);

  const [subscriptions, followRows] = await Promise.all([
    prisma.subscription.findMany({
      where: { subscriberId: userId, status: "ACTIVE" },
      include: { handicapper: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.follow.findMany({ where: { followerId: userId }, select: { handicapperId: true } }),
  ]);

  // Followed handicappers, paid plans first then alphabetical by name.
  const followed = sortPaidFirst(
    await listHandicapperSummariesByIds(followRows.map((f) => f.handicapperId)),
    (a, b) => a.displayName.localeCompare(b.displayName)
  );

  const handicapperIds = subscriptions.map((s) => s.handicapperId);

  // Lightweight pull for records/analytics (every pick), plus a richer pull for
  // the feed itself (capped, with handicapper attribution).
  const [statsPicks, rawFeedPicks] = handicapperIds.length
    ? await Promise.all([
        prisma.pick.findMany({
          where: { handicapperId: { in: handicapperIds } },
          select: {
            handicapperId: true,
            odds: true,
            units: true,
            result: true,
            settledAt: true,
            eventStartsAt: true,
          },
        }),
        prisma.pick.findMany({
          where: { handicapperId: { in: handicapperIds } },
          include: { handicapper: true, parlayLegs: { orderBy: { order: "asc" } } },
          orderBy: { eventStartsAt: "desc" },
          take: 60,
        }),
      ])
    : [[], []];

  // Attach team crests to the feed picks (and their parlay legs) for display.
  const feedPicks = await enrichPickCrests(rawFeedPicks);

  const now = Date.now();
  const isUpcoming = (p: { result: string; eventStartsAt: Date }) =>
    p.result === "PENDING" && p.eventStartsAt.getTime() >= now;

  const combined = computeStats(statsPicks);
  const monthlySpendCents = subscriptions.reduce((sum, s) => sum + s.handicapper.monthlyPriceCents, 0);

  // Per-handicapper record, ranked by units won, so the best of who you follow floats up.
  const perCapper = subscriptions
    .map((sub) => {
      const ps = statsPicks.filter((p) => p.handicapperId === sub.handicapperId);
      return {
        sub,
        stats: computeStats(ps),
        points: cumulativeUnits(ps),
        upcoming: ps.filter(isUpcoming).length,
      };
    })
    .sort((a, b) => b.stats.unitsNet - a.stats.unitsNet);

  const upcomingPicks = feedPicks
    .filter(isUpcoming)
    .sort((a, b) => a.eventStartsAt.getTime() - b.eventStartsAt.getTime());
  const recentPicks = feedPicks.filter((p) => !isUpcoming(p));

  return {
    currentUser,
    handicapperProfile,
    subscriptions,
    followed,
    feedPicks,
    combined,
    monthlySpendCents,
    perCapper,
    upcomingPicks,
    recentPicks,
  };
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/signin?callbackUrl=/dashboard");

  const {
    currentUser,
    handicapperProfile,
    subscriptions,
    followed,
    feedPicks,
    combined,
    monthlySpendCents,
    perCapper,
    upcomingPicks,
    recentPicks,
  } = await loadDashboard(session.user.id);

  // Stacked sections, keyed by the section catalog. The page heading and verify
  // banner stay pinned to the top; the rest render in the catalog order.
  const sections: Record<string, ReactNode> = {
    summary: subscriptions.length > 0 && (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Subscribed" value={subscriptions.length.toString()} />
        <StatCard label="Monthly spend" value={formatCents(monthlySpendCents)} />
        <StatCard label="Combined record" value={combined.record} />
        <StatCard
          label="Combined units"
          value={formatUnits(combined.unitsNet)}
          tone={combined.unitsNet > 0 ? "accent" : combined.unitsNet < 0 ? "danger" : "default"}
        />
      </div>
    ),
    handicappers: perCapper.length > 0 && (
      <section>
        <h2 className="mb-3 font-semibold">Your handicappers</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {perCapper.map(({ sub, stats, points, upcoming }) => (
            <div key={sub.id} className="card p-5">
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/handicappers/${sub.handicapper.handle}`}
                  className="flex min-w-0 items-center gap-2 hover:text-accent"
                >
                  <Avatar
                    src={sub.handicapper.avatarUrl}
                    name={sub.handicapper.displayName}
                    className="h-9 w-9 shrink-0 rounded-full text-xs"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{sub.handicapper.displayName}</span>
                    <span className="block truncate text-xs text-muted">@{sub.handicapper.handle}</span>
                  </span>
                </Link>
                <span
                  className={
                    stats.unitsNet > 0
                      ? "shrink-0 text-sm font-semibold text-accent"
                      : stats.unitsNet < 0
                        ? "shrink-0 text-sm font-semibold text-danger"
                        : "shrink-0 text-sm font-semibold text-muted"
                  }
                >
                  {formatUnits(stats.unitsNet)}
                </span>
              </div>

              <UnitsChart points={points} className="mt-4" />

              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
                <div>
                  <p className="text-sm font-bold tabular-nums">{stats.record}</p>
                  <p className="text-[11px] text-muted">Record</p>
                </div>
                <div>
                  <p className="text-sm font-bold tabular-nums">
                    {stats.winRate != null ? `${stats.winRate.toFixed(0)}%` : "—"}
                  </p>
                  <p className="text-[11px] text-muted">Win rate</p>
                </div>
                <div>
                  <p className="text-sm font-bold tabular-nums text-accent">{upcoming || "—"}</p>
                  <p className="text-[11px] text-muted">Upcoming</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    ),
    following: followed.length > 0 && (
      <section>
        <h2 className="mb-1 font-semibold">Following</h2>
        <p className="mb-3 text-sm text-muted">
          Handicappers you follow to track their stats — paid plans first, then alphabetical.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {followed.map((h) => (
            <HandicapperCard key={h.id} handicapper={h} />
          ))}
        </div>
      </section>
    ),
    feed: (
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex-1">
          {feedPicks.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-muted">You&apos;re not subscribed to any handicappers yet.</p>
              <Link
                href="/leaderboard"
                className="mt-4 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90"
              >
                Browse the leaderboard
              </Link>
            </div>
          ) : (
            <div className="space-y-8">
              {upcomingPicks.length > 0 && (
                <section>
                  <h2 className="mb-3 flex items-center gap-2 font-semibold">
                    Upcoming
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                      {upcomingPicks.length}
                    </span>
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {upcomingPicks.map((pick) => (
                      <PickAttribution key={pick.id} pick={pick} />
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h2 className="mb-3 font-semibold">Recent results</h2>
                {recentPicks.length === 0 ? (
                  <p className="text-sm text-muted">No settled picks yet.</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {recentPicks.map((pick) => (
                      <PickAttribution key={pick.id} pick={pick} />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>

        <aside className="w-full lg:w-72">
          <div className="card p-5">
            <h2 className="font-semibold">Your subscriptions</h2>
            {subscriptions.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No active subscriptions.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {subscriptions.map((sub) => (
                  <li key={sub.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link
                      href={`/handicappers/${sub.handicapper.handle}`}
                      className="flex min-w-0 items-center gap-2 hover:text-accent"
                    >
                      <Avatar
                        src={sub.handicapper.avatarUrl}
                        name={sub.handicapper.displayName}
                        className="h-6 w-6 shrink-0 rounded-full text-[10px]"
                      />
                      <span className="truncate">@{sub.handicapper.handle}</span>
                    </Link>
                    <span className="shrink-0 text-muted">
                      {sub.currentPeriodEnd
                        ? `renews ${sub.currentPeriodEnd.toLocaleDateString()}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {subscriptions.length > 0 && (
              <div className="mt-4">
                <ManageBillingButton />
              </div>
            )}
          </div>

          {!handicapperProfile && (
            <div className="card mt-4 border-accent/40 bg-accent/5 p-5">
              <h2 className="font-semibold">Start selling your own picks</h2>
              <p className="mt-2 text-sm text-muted">
                Got a winning record? Build a public track record and get paid by subscribers — keep
                using this account, no need to sign up again.
              </p>
              <Link
                href="/dashboard/handicapper"
                className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
              >
                Become a handicapper
              </Link>
            </div>
          )}
        </aside>
      </div>
    ),
  };

  const order = resolveSectionOrder("subscriber", await getSetting(DASHBOARD_ORDER_SETTING.subscriber));

  return (
    <div className="container-page py-12">
      <h1 className="text-3xl font-bold">Your feed</h1>
      <p className="mt-2 text-muted">Picks and performance from the handicappers you follow.</p>

      {!currentUser?.emailVerified && (
        <div className="mt-6">
          <VerifyEmailBanner />
        </div>
      )}

      {order.map((key) =>
        sections[key] ? (
          <div key={key} className="mt-8">
            {sections[key]}
          </div>
        ) : null
      )}
    </div>
  );
}

type FeedPick = Prisma.PickGetPayload<{ include: { handicapper: true; parlayLegs: true } }>;

// A feed pick with a link back to the handicapper who posted it.
function PickAttribution({ pick }: { pick: FeedPick }) {
  return (
    <div>
      <Link
        href={`/handicappers/${pick.handicapper.handle}`}
        className="mb-1.5 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-accent"
      >
        <Avatar
          src={pick.handicapper.avatarUrl}
          name={pick.handicapper.displayName}
          className="h-5 w-5 rounded-full text-[9px]"
        />
        @{pick.handicapper.handle}
      </Link>
      <PickCard pick={pick} />
    </div>
  );
}
