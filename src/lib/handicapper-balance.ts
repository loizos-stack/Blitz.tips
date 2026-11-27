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
};

export async function handicapperBalance(handicapperId: string): Promise<HandicapperBalance> {
  const [platform, crypto, direct, payouts] = await Promise.all([
    prisma.platformEarning.findMany({
      where: { handicapperId },
      select: { amountCents: true, netCents: true },
    }),
    prisma.cryptoPayment.findMany({
      where: { handicapperId, status: "CONFIRMED" },
      select: { amountCents: true, netCents: true },
    }),
    prisma.directPayment.findMany({
      where: { handicapperId, status: "CONFIRMED" },
      select: { amountCents: true, netCents: true },
    }),
    prisma.handicapperPayout.findMany({
      where: { handicapperId },
      select: { amountCents: true },
    }),
  ]);

  const earned = [...platform, ...crypto, ...direct];
  const grossCents = earned.reduce((sum, r) => sum + r.amountCents, 0);
  const netCents = earned.reduce((sum, r) => sum + r.netCents, 0);
  const paidCents = payouts.reduce((sum, r) => sum + r.amountCents, 0);

  return {
    grossCents,
    netCents,
    paidCents,
    outstandingCents: netCents - paidCents,
    count: earned.length,
  };
}
