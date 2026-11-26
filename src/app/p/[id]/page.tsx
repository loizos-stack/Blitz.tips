import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/site";
import { isPickLocked, redactLockedPick } from "@/lib/pick-visibility";
import { canBypassPickPaywall } from "@/lib/permissions";
import { isSubscriptionActive } from "@/lib/subscription-status";
import { enrichPickCrests } from "@/lib/pick-logos";
import { sportsbookForVisitor } from "@/lib/sportsbooks";
import { PickCard } from "@/components/pick-card";
import { ShareButtons } from "@/components/share-buttons";
import { Avatar } from "@/components/avatar";
import { SHARE_CARD_SIZE } from "@/lib/share-cards";
import { SPORT_LABELS, BET_TYPE_LABELS } from "@/lib/utils";
import { Lock } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * One pick, at its own URL.
 *
 * It exists because the share buttons had nowhere good to point. They linked to
 * `/handicappers/{handle}`, so X, Facebook and Telegram all previewed the
 * *profile* card — the handicapper's record — whatever pick was being shared.
 * The pick's own card was rendered, as a PNG, and then shown to nobody.
 *
 * So this page's whole job is to be a link worth sending: the card, who posted
 * it, and a way through to the rest of their record. The social preview is the
 * same image the download button hands you (/api/share/pick/[id]), which is
 * already built, already mirrors the on-site card, and already renders a locked
 * premium pick as a teaser that gives nothing away.
 */

type LoadedPick = NonNullable<Awaited<ReturnType<typeof loadPick>>>;

async function loadPick(id: string) {
  const pick = await prisma.pick.findUnique({
    where: { id },
    include: {
      parlayLegs: { select: { id: true, matchup: true, selection: true, odds: true } },
      handicapper: {
        select: { id: true, handle: true, displayName: true, avatarUrl: true, suspendedAt: true },
      },
    },
  });
  // A suspended handicapper disappears from the public site, and that has to
  // include their pick links — otherwise a suspension leaves live, shareable
  // pages behind it. Matches the share image route, which 404s on the same
  // condition.
  if (!pick || !pick.handicapper || pick.handicapper.suspendedAt) return null;
  return pick;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const pick = await loadPick(id);
  if (!pick) return { title: "Pick not found" };

  // Metadata is written for a crawler, and a crawler is never signed in — so
  // the locked/unlocked decision here is deliberately the anonymous one, the
  // same one the share image makes. A subscriber sees more on the page than
  // the preview card shows; that asymmetry is correct.
  const locked = isPickLocked(pick, false);
  const { displayName, handle } = pick.handicapper;
  const sportLabel = SPORT_LABELS[pick.sport] ?? pick.sport;
  const path = `/p/${pick.id}`;

  const title = locked
    ? `Premium ${sportLabel} pick from ${displayName}`
    : `${pick.selection} — ${pick.matchup}`;

  const description = locked
    ? `${displayName} posted a premium ${sportLabel} pick on Blitz.tips. Subscribe to see the play before it starts.`
    : `${displayName} (@${handle}) on Blitz.tips: ${BET_TYPE_LABELS[pick.betType] ?? pick.betType}, ` +
      `${pick.selection} at ${pick.odds > 0 ? `+${pick.odds}` : pick.odds} for ${pick.units}u. ` +
      `Posted before kickoff and graded automatically.`;

  return {
    title,
    description,
    alternates: { canonical: path },
    // A locked pick's page shows a teaser and nothing else, so there is no
    // content for a search result to be about — asking for it to be indexed
    // would be asking Google to rank an empty box. `follow` stays on so the
    // link through to the handicapper still counts. Once the pick unlocks
    // (graded, or two hours after kickoff) the page becomes indexable on its
    // own, with no backfill needed: this is evaluated per request.
    ...(locked ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type: "article",
      title,
      description,
      url: path,
      images: [
        {
          url: `${siteUrl()}/api/share/pick/${pick.id}`,
          width: SHARE_CARD_SIZE.width,
          height: SHARE_CARD_SIZE.height,
          alt: locked
            ? `Premium pick from ${displayName} on Blitz.tips`
            : `${pick.selection} — ${pick.matchup}`,
        },
      ],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PickPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pick = await loadPick(id);
  if (!pick) notFound();

  const session = await auth();
  const unlocked = await viewerCanSee(pick, session?.user.id);
  const locked = isPickLocked(pick, unlocked);

  const [enriched] = await enrichPickCrests([pick]);
  const book = await sportsbookForVisitor();
  const { displayName, handle, avatarUrl } = pick.handicapper;
  const url = `${siteUrl()}/p/${pick.id}`;

  const shareText = locked
    ? `New premium pick is live from ${displayName} on Blitz.tips — subscribe to tail it before it starts.`
    : `${displayName}: ${pick.selection} — ${pick.matchup}. ${
        pick.result === "PENDING" ? "Posted before kickoff" : "Tracked & graded"
      } on Blitz.tips.`;

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-xl">
        {/* Whose pick this is, before the pick itself. A card arriving from a
            link has no profile page around it to say so. */}
        <Link
          href={`/handicappers/${handle}`}
          className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-3 hover:border-accent/60"
        >
          <Avatar src={avatarUrl} name={displayName} className="h-11 w-11 rounded-full" />
          <span className="min-w-0">
            <span className="block truncate font-display font-semibold group-hover:text-accent">
              {displayName}
            </span>
            <span className="block truncate text-sm text-muted">@{handle}</span>
          </span>
        </Link>

        <div className="mt-4">
          <PickCard
            pick={locked ? redactLockedPick(enriched) : enriched}
            locked={locked}
            book={book}
          />
        </div>

        {locked && (
          <div className="mt-4 rounded-xl border border-gold/40 bg-gold/5 p-4 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <Lock className="h-4 w-4 text-gold" />
              This pick is for {displayName}&apos;s subscribers
            </p>
            <p className="mt-1 text-muted">
              It unlocks for everyone two hours after the game starts, or as soon as it&apos;s
              graded — so the record stays checkable either way.
            </p>
            <Link
              href={`/handicappers/${handle}`}
              className="mt-3 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
            >
              See subscription options
            </Link>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/handicappers/${handle}`}
            className="text-sm font-medium text-muted hover:text-accent"
          >
            View {displayName}&apos;s full record →
          </Link>
          <ShareButtons url={url} text={shareText} />
        </div>
      </div>
    </div>
  );
}

/**
 * Whether this viewer may see the play itself.
 *
 * The same three ways in as the public profile — the handicapper themselves, an
 * active subscriber, or an admin who manages picks — because a pick shown at
 * two URLs that disagree about who may read it is a paywall with a hole in it.
 */
async function viewerCanSee(pick: LoadedPick, userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  if (pick.handicapper.id && (await ownsProfile(pick.handicapper.id, userId))) return true;

  const sub = await prisma.subscription.findUnique({
    where: {
      subscriberId_handicapperId: { subscriberId: userId, handicapperId: pick.handicapperId },
    },
  });
  if (isSubscriptionActive(sub)) return true;

  return canBypassPickPaywall();
}

async function ownsProfile(handicapperId: string, userId: string): Promise<boolean> {
  const profile = await prisma.handicapperProfile.findUnique({
    where: { id: handicapperId },
    select: { userId: true },
  });
  return profile?.userId === userId;
}
