import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * What the platform is holding for one handicapper, and what it has sent.
 *
 * Three rails end with the platform owing a handicapper money: crypto, an
 * off-platform transfer, and — since handicappers who never finished Connect
 * onboarding could otherwise not sell at all — a card payment the platform
 * collected on their behalf. They are summed together because to the person
 * waiting for the money they are one number.
 *
 * Connect sales are deliberately absent. Stripe pays those out itself, so
 * counting them here would show a handicapper a balance they have already
 * received.
 *
 * On currency: the three ledgers each carry one, and this adds them without
 * converting. That is safe in practice because a handicapper prices in exactly
 * one currency, so every row of theirs shares it — but it is an assumption,
 * and if per-handicapper multi-currency pricing ever arrives this has to split
 * by currency before it sums.
 */
export type HandicapperBalance = {
  /** What subscribers paid, before the platform's cut. */
  grossCents: number;
  /** The handicapper's share of that. */
  netCents: number;
  /** Already sent on. */
  paidCents: number;
  /** Still to send. Can go negative if an advance was paid. */
  outstandingCents: number;
  /** How many payments make up `netCents`. */
  count: number;
  /** The handicapper's share of what came in this calendar month. */
  monthCents: number;
  /** ...and in the last 30 days, which is the one that moves daily. */
  last30Cents: number;
  /** When the first of these payments landed, i.e. how long this adds up. */
  firstEarnedAt: Date | null;
  /** When the platform last sent money on. Null until it has. */
  lastPaidAt: Date | null;
};

export async function handicapperBalance(handicapperId: string): Promise<HandicapperBalance> {
  const [platform, crypto, direct, payouts] = await Promise.all([
    prisma.platformEarning.findMany({
      where: { handicapperId },
      select: { amountCents: true, netCents: true, paidAt: true },
    }),
    prisma.cryptoPayment.findMany({
      where: { handicapperId, status: "CONFIRMED" },
      select: { amountCents: true, netCents: true, confirmedAt: true, createdAt: true },
    }),
    prisma.directPayment.findMany({
      where: { handicapperId, status: "CONFIRMED" },
      select: { amountCents: true, netCents: true, decidedAt: true, createdAt: true },
    }),
    prisma.handicapperPayout.findMany({
      where: { handicapperId },
      select: { amountCents: true, paidAt: true },
    }),
  ]);

  // Each rail dates a payment differently, and the row's own createdAt is the
  // fallback rather than the source: a webhook or an admin can write the row
  // days after the money moved, and it is when the money moved that decides
  // which month it counts towards.
  const earned: { amountCents: number; netCents: number; at: Date }[] = [
    ...platform.map((r) => ({ amountCents: r.amountCents, netCents: r.netCents, at: r.paidAt })),
    ...crypto.map((r) => ({
      amountCents: r.amountCents,
      netCents: r.netCents,
      at: r.confirmedAt ?? r.createdAt,
    })),
    ...direct.map((r) => ({
      amountCents: r.amountCents,
      netCents: r.netCents,
      at: r.decidedAt ?? r.createdAt,
    })),
  ];

  const grossCents = earned.reduce((sum, r) => sum + r.amountCents, 0);
  const netCents = earned.reduce((sum, r) => sum + r.netCents, 0);
  const paidCents = payouts.reduce((sum, r) => sum + r.amountCents, 0);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sumSince = (from: Date) =>
    earned.reduce((sum, r) => (r.at >= from ? sum + r.netCents : sum), 0);

  const earliest = earned.reduce<Date | null>(
    (min, r) => (min === null || r.at < min ? r.at : min),
    null
  );
  const latestPayout = payouts.reduce<Date | null>(
    (max, r) => (max === null || r.paidAt > max ? r.paidAt : max),
    null
  );

  return {
    grossCents,
    netCents,
    paidCents,
    outstandingCents: netCents - paidCents,
    count: earned.length,
    monthCents: sumSince(monthStart),
    last30Cents: sumSince(thirtyDaysAgo),
    firstEarnedAt: earliest,
    lastPaidAt: latestPayout,
  };
}
