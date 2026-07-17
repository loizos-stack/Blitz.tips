import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getHandicapperByHandle } from "@/lib/handicappers";
import { summarizeRatings } from "@/lib/reviews";
import { ReviewsList, type ReviewItem } from "@/components/reviews-list";
import { Stars } from "@/components/stars";
import { StatCard } from "@/components/stat-card";
import { PickCard } from "@/components/pick-card";
import { PaginatedTrackRecord } from "@/components/paginated-track-record";
import { SubscribeButton } from "@/components/subscribe-button";
import { FollowButton } from "@/components/follow-button";
import { SocialLinks } from "@/components/social-links";
import { Avatar } from "@/components/avatar";
import { SportIcon } from "@/components/sport-icon";
import { SPORT_LABELS } from "@/lib/utils";
import { PlanBadge } from "@/components/plan-badge";
import { getSetting } from "@/lib/settings";
import { DASHBOARD_ORDER_SETTING, resolveSectionOrder } from "@/lib/dashboard-sections";
import { isSubscriptionActive } from "@/lib/subscription-status";
import { nowPaymentsConfigured } from "@/lib/nowpayments";
import { enrichPickCrests } from "@/lib/pick-logos";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const handicapper = await getHandicapperByHandle(handle);
  if (!handicapper) return {};
  return {
    title: handicapper.displayName,
    description: `${handicapper.displayName}'s verified sports betting record on Blitz.tips: ${handicapper.stats.record}, ${handicapper.stats.unitsNet >= 0 ? "+" : ""}${handicapper.stats.unitsNet.toFixed(1)} units.`,
  };
}

export default async function HandicapperProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const handicapper = await getHandicapperByHandle(handle);
  if (!handicapper) notFound();

  const session = await auth();
  const isOwner = session?.user.id && handicapper.userId === session.user.id;

  // Suspended profiles disappear from the public site; the owner and admins
  // can still open them (the owner sees the suspension notice below).
  if (handicapper.suspendedAt && !isOwner && session?.user.role !== "ADMIN") notFound();

  let isSubscribed = false;
  let isFollowing = false;
  if (session?.user.id && !isOwner) {
    const [sub, follow] = await Promise.all([
      prisma.subscription.findUnique({
        where: {
          subscriberId_handicapperId: { subscriberId: session.user.id, handicapperId: handicapper.id },
        },
      }),
      prisma.follow.findUnique({
        where: {
          followerId_handicapperId: { followerId: session.user.id, handicapperId: handicapper.id },
        },
      }),
    ]);
    isSubscribed = isSubscriptionActive(sub);
    isFollowing = Boolean(follow);
  }

  const unlocked = isOwner || isSubscribed;
  const picks = await enrichPickCrests(handicapper.picksList);
  const pendingPicks = picks.filter((p) => p.result === "PENDING");
  const settledPicks = picks.filter((p) => p.result !== "PENDING");

  // Reviews are display-only here (writing happens in the subscriber dashboard).
  // Only APPROVED reviews are loaded, so the summary reflects the public set.
  const ratingSummary = summarizeRatings(handicapper.reviews.map((r) => r.rating));
  const reviewItems: ReviewItem[] = handicapper.reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
    authorName: r.author.name || r.author.username || "Subscriber",
    authorAvatarUrl: r.author.image,
  }));

  // The stacked sections below the profile header; the cover, identity, and
  // subscribe box stay pinned above them.
  const sections: Record<string, ReactNode> = {
    stats: (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Record" value={handicapper.stats.record} />
        <StatCard
          label="Win rate"
          value={handicapper.stats.winRate ? `${handicapper.stats.winRate.toFixed(1)}%` : "—"}
        />
        <StatCard
          label="Net units"
          value={`${handicapper.stats.unitsNet >= 0 ? "+" : ""}${handicapper.stats.unitsNet.toFixed(1)}`}
          tone={handicapper.stats.unitsNet >= 0 ? "accent" : "danger"}
        />
        <StatCard label="ROI" value={handicapper.stats.roi !== null ? `${handicapper.stats.roi.toFixed(1)}%` : "—"} />
        <StatCard
          label="L10"
          value={handicapper.last10Stats.totalPicks > 0 ? handicapper.last10Stats.record : "—"}
          sub={
            handicapper.last10Stats.totalPicks > 0
              ? `${handicapper.last10Stats.unitsNet >= 0 ? "+" : ""}${handicapper.last10Stats.unitsNet.toFixed(1)}u`
              : undefined
          }
          subTone={handicapper.last10Stats.unitsNet >= 0 ? "accent" : "danger"}
        />
        <StatCard
          label="Last 30 days"
          value={handicapper.last30Stats.totalPicks > 0 ? handicapper.last30Stats.record : "—"}
          sub={
            handicapper.last30Stats.totalPicks > 0
              ? `${handicapper.last30Stats.unitsNet >= 0 ? "+" : ""}${handicapper.last30Stats.unitsNet.toFixed(1)}u`
              : undefined
          }
          subTone={handicapper.last30Stats.unitsNet >= 0 ? "accent" : "danger"}
        />
      </div>
    ),
    pendingPlays: pendingPicks.length > 0 && (
      <>
        <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
          Pending tips
          <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold">
            {pendingPicks.length} pending
          </span>
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {pendingPicks.map((pick) => (
            <PickCard key={pick.id} pick={pick} locked={pick.isPremium && !unlocked} />
          ))}
        </div>
      </>
    ),
    reviews: (
      <ReviewsList
        displayName={handicapper.displayName}
        average={ratingSummary.average}
        count={ratingSummary.count}
        reviews={reviewItems}
      />
    ),
    trackRecord: (
      <>
        <h2 className="mb-4 text-xl font-bold">Track record</h2>
        {picks.length === 0 ? (
          <p className="text-muted">No picks posted yet.</p>
        ) : settledPicks.length === 0 ? (
          <p className="text-muted">No settled picks yet — see the pending tips above.</p>
        ) : (
          <PaginatedTrackRecord picks={settledPicks} unlocked={unlocked} />
        )}
      </>
    ),
  };

  const profileOrder = resolveSectionOrder("profile", await getSetting(DASHBOARD_ORDER_SETTING.profile));

  return (
    <div>
      <div className="h-40 w-full overflow-hidden bg-gradient-to-r from-accent/20 via-surface-raised to-gold/15 sm:h-56">
        {handicapper.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded cover (Vercel Blob URL)
          <img src={handicapper.coverUrl} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="container-page pb-12">
      {handicapper.suspendedAt && (
        <div className="mb-6 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm">
          This profile is suspended and hidden from the public site. Contact support if you believe
          this is a mistake.
        </div>
      )}
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <Avatar
            src={handicapper.avatarUrl}
            name={handicapper.displayName}
            className="-mt-12 h-24 w-24 shrink-0 rounded-full border-4 border-surface text-2xl sm:-mt-16"
          />
          <div className="pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{handicapper.displayName}</h1>
              <PlanBadge plan={handicapper.plan} planStatus={handicapper.planStatus} size="md" />
              {!isOwner && (
                <FollowButton handicapperId={handicapper.id} initialFollowing={isFollowing} />
              )}
            </div>
            <p className="text-muted">@{handicapper.handle}</p>
            {ratingSummary.average !== null && (
              <div className="mt-2 flex items-center gap-2 text-sm">
                <Stars value={ratingSummary.average} />
                <span className="font-semibold">{ratingSummary.average.toFixed(1)}</span>
                <span className="text-muted">
                  ({ratingSummary.count} review{ratingSummary.count === 1 ? "" : "s"})
                </span>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {handicapper.sports.map((sport) => (
                <span
                  key={sport}
                  className="flex items-center gap-1.5 rounded-full bg-surface-raised px-2.5 py-1 text-xs text-muted"
                >
                  <SportIcon sport={sport} className="h-3.5 w-3.5" />
                  {SPORT_LABELS[sport]}
                </span>
              ))}
            </div>
            {handicapper.bio && <p className="mt-4 max-w-xl text-sm text-muted">{handicapper.bio}</p>}
            <SocialLinks profile={handicapper} className="mt-4" />
          </div>
        </div>

        <div className="w-full md:w-80">
          {!isOwner && isSubscribed ? (
            <div className="card p-4 text-center text-sm text-accent">You&apos;re subscribed</div>
          ) : (
            <SubscribeButton
              handicapperId={handicapper.id}
              displayName={handicapper.displayName}
              packages={{
                WEEKLY: handicapper.weeklyPriceCents,
                MONTHLY: handicapper.monthlyPriceCents,
                ANNUAL: handicapper.annualPriceCents,
              }}
              isSignedIn={Boolean(session)}
              isReady={handicapper.stripeAccountReady}
              isOwner={Boolean(isOwner)}
              cryptoEnabled={nowPaymentsConfigured()}
              trialDays={handicapper.subscriptionTrialDays}
              currency={handicapper.priceCurrency}
            />
          )}
        </div>
      </div>

      {profileOrder.map((key) =>
        sections[key] ? (
          <div key={key} className="mt-8">
            {sections[key]}
          </div>
        ) : null
      )}
      </div>
    </div>
  );
}
