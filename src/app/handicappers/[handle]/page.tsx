import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getHandicapperByHandle } from "@/lib/handicappers";
import { StatCard } from "@/components/stat-card";
import { PickCard } from "@/components/pick-card";
import { SubscribeButton } from "@/components/subscribe-button";
import { Avatar } from "@/components/avatar";
import { SportIcon } from "@/components/sport-icon";
import { SPORT_LABELS } from "@/lib/utils";

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

  let isSubscribed = false;
  if (session?.user.id && !isOwner) {
    const sub = await prisma.subscription.findUnique({
      where: {
        subscriberId_handicapperId: { subscriberId: session.user.id, handicapperId: handicapper.id },
      },
    });
    isSubscribed = sub?.status === "ACTIVE";
  }

  const unlocked = isOwner || isSubscribed;
  const picks = handicapper.picksList;

  return (
    <div>
      <div className="h-40 w-full overflow-hidden bg-gradient-to-r from-accent/20 via-surface-raised to-gold/15 sm:h-56">
        {handicapper.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded cover (Vercel Blob URL)
          <img src={handicapper.coverUrl} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="container-page pb-12">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <Avatar
            src={handicapper.avatarUrl}
            name={handicapper.displayName}
            className="-mt-12 h-24 w-24 shrink-0 rounded-full border-4 border-surface text-2xl sm:-mt-16"
          />
          <div className="pt-2">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{handicapper.displayName}</h1>
              {handicapper.isVerified && <BadgeCheck className="h-5 w-5 text-accent" />}
            </div>
            <p className="text-muted">@{handicapper.handle}</p>
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
          </div>
        </div>

        {!isOwner && (
          <div className="w-full md:w-64">
            {unlocked ? (
              <div className="card p-4 text-center text-sm text-accent">You&apos;re subscribed</div>
            ) : (
              <SubscribeButton
                handicapperId={handicapper.id}
                priceCents={handicapper.monthlyPriceCents}
                isSignedIn={Boolean(session)}
                isReady={handicapper.stripeAccountReady}
              />
            )}
          </div>
        )}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
      </div>

      <p className="mt-3 text-xs text-muted">
        Last 30 days: {handicapper.last30Stats.record} · {handicapper.last30Stats.unitsNet >= 0 ? "+" : ""}
        {handicapper.last30Stats.unitsNet.toFixed(1)}u
      </p>

      <div className="mt-10">
        <h2 className="mb-4 text-xl font-bold">Picks</h2>
        {picks.length === 0 ? (
          <p className="text-muted">No picks posted yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {picks.map((pick) => (
              <PickCard key={pick.id} pick={pick} locked={pick.isPremium && !unlocked} />
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
