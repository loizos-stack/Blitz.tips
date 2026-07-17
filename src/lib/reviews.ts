import "server-only";
import { prisma } from "@/lib/prisma";

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
