import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Referrals.
 *
 * Supply is the constraint on a two-sided marketplace long before demand is:
 * readers arrive for cappers who are already here. So the link that matters is
 * the one a capper hands to another capper, and the mechanic has to be simple
 * enough to explain in a sentence — a code in a URL, credited at signup.
 *
 * Attribution is deliberately narrow and permanent:
 *
 * - It's recorded once, at account creation, and never updated. A referral that
 *   can be reassigned later is an argument waiting to happen, and the first
 *   thing anyone would try is claiming a user who was already here.
 * - Self-referral needs no check: attribution is written at account creation,
 *   and an account that doesn't exist yet can't own the code being used. (If
 *   crediting ever moves later than signup, that stops being true and a check
 *   becomes necessary.)
 * - A code that doesn't resolve credits nobody, silently. A signup must never
 *   fail because someone pasted a link wrong.
 * - It records *who*, not *what they earned*. Whether a referral pays a fee
 *   holiday, a cash bounty or nothing is a business decision that can change
 *   without touching this; the relationship is the durable part.
 */

// No I, O, 0 or 1 — these get read aloud, written down and retyped.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 7;

function randomCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/**
 * This user's referral code, generated on first use.
 *
 * Lazy rather than assigned at signup, so existing accounts get one the moment
 * they look for it and nothing needs backfilling.
 */
export async function ensureReferralCode(userId: string): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });
  if (existing?.referralCode) return existing.referralCode;

  // Retry on the astronomically unlikely collision rather than trusting luck.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { referralCode: code },
        select: { referralCode: true },
      });
      return updated.referralCode!;
    } catch (e) {
      if ((e as { code?: string })?.code !== "P2002") throw e;
    }
  }
  throw new Error("Could not allocate a referral code");
}

/**
 * Resolve a referral code to the user who owns it.
 *
 * Returns null for anything that doesn't resolve — an expired link, a typo, a
 * deleted account — because the caller's job (creating an account) must succeed
 * regardless.
 */
export async function resolveReferrer(code: string | null | undefined): Promise<string | null> {
  const trimmed = code?.trim().toUpperCase();
  if (!trimmed || trimmed.length !== CODE_LENGTH) return null;

  const owner = await prisma.user.findUnique({
    where: { referralCode: trimmed },
    select: { id: true, suspendedAt: true },
  });
  if (!owner || owner.suspendedAt) return null;
  return owner.id;
}

export interface ReferralStats {
  code: string;
  total: number;
  /** Of those, how many went on to become handicappers — the ones that matter. */
  handicappers: number;
}

export async function referralStats(userId: string): Promise<ReferralStats> {
  const [code, total, handicappers] = await Promise.all([
    ensureReferralCode(userId),
    prisma.user.count({ where: { referredById: userId } }),
    prisma.user.count({ where: { referredById: userId, handicapper: { isNot: null } } }),
  ]);
  return { code, total, handicappers };
}

/** The cookie a referral link drops, read at signup. */
export const REFERRAL_COOKIE = "blitz_ref";
// Long enough to survive "I'll sign up later", short enough that a code can't
// haunt a shared browser for a year.
export const REFERRAL_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;
