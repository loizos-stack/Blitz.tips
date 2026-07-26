import "server-only";
import { prisma } from "@/lib/prisma";
import type { ReviewStatus } from "@prisma/client";

/**
 * Whether a user is eligible to review a handicapper. Reviews are limited to
 * people who have actually paid for one of the handicapper's packages — current
 * OR past. That means either:
 *   - a Stripe/comped Subscription row that got past INCOMPLETE (i.e. they were
 *     billed / granted access at some point), or
 *   - a CONFIRMED crypto access pass.
 * The handicapper can't review their own profile.
 */
export async function canReview(userId: string, handicapperId: string): Promise<boolean> {
  const profile = await prisma.handicapperProfile.findUnique({
    where: { id: handicapperId },
    select: { userId: true },
  });
  if (!profile || profile.userId === userId) return false;

  const [sub, crypto] = await Promise.all([
    prisma.subscription.findFirst({
      where: { subscriberId: userId, handicapperId, status: { not: "INCOMPLETE" } },
      select: { id: true },
    }),
    prisma.cryptoPayment.findFirst({
      where: { subscriberId: userId, handicapperId, status: "CONFIRMED" },
      select: { id: true },
    }),
  ]);
  return Boolean(sub || crypto);
}

export interface ReviewableHandicapper {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  /** The user's existing review of this handicapper, if any (with its moderation status). */
  review: { rating: number; body: string | null; status: ReviewStatus } | null;
}

/**
 * The handicappers a user is allowed to review: everyone whose paid package
 * they've held (current or past) — a Stripe/comped subscription past INCOMPLETE
 * or a confirmed crypto pass — with their existing review attached. Suspended
 * handicappers are excluded (their profiles are hidden). Empty array = the user
 * has never paid for any package, so they can't leave a review at all.
 */
export async function reviewableHandicappers(userId: string): Promise<ReviewableHandicapper[]> {
  const [subs, cryptos] = await Promise.all([
    prisma.subscription.findMany({
      where: { subscriberId: userId, status: { not: "INCOMPLETE" } },
      select: { handicapperId: true },
    }),
    prisma.cryptoPayment.findMany({
      where: { subscriberId: userId, status: "CONFIRMED" },
      select: { handicapperId: true },
    }),
  ]);

  const ids = [...new Set([...subs.map((s) => s.handicapperId), ...cryptos.map((c) => c.handicapperId)])];
  if (ids.length === 0) return [];

  const [profiles, reviews] = await Promise.all([
    prisma.handicapperProfile.findMany({
      where: { id: { in: ids }, suspendedAt: null },
      select: { id: true, handle: true, displayName: true, avatarUrl: true },
    }),
    prisma.review.findMany({
      where: { authorId: userId, handicapperId: { in: ids } },
      select: { handicapperId: true, rating: true, body: true, status: true },
    }),
  ]);

  const byHandicapper = new Map(
    reviews.map((r) => [r.handicapperId, { rating: r.rating, body: r.body, status: r.status }])
  );
  return profiles
    .map((p) => ({ ...p, review: byHandicapper.get(p.id) ?? null }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export interface RatingSummary {
  /** Mean rating rounded to one decimal, or null when there are no reviews. */
  average: number | null;
  count: number;
}

export function summarizeRatings(ratings: number[]): RatingSummary {
  if (ratings.length === 0) return { average: null, count: 0 };
  const sum = ratings.reduce((a, r) => a + r, 0);
  return { average: Math.round((sum / ratings.length) * 10) / 10, count: ratings.length };
}
