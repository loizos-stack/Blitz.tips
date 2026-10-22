import "server-only";
import { prisma } from "@/lib/prisma";
import { PLAN_DEFINITIONS } from "@/lib/plans";
import {
  sendEmail,
  compGrantedEmailHtml,
  compGrantedEmailText,
  compEndingEmailHtml,
  compEndingEmailText,
  compEndedEmailHtml,
  compEndedEmailText,
} from "@/lib/email";
import type { HandicapperPlan } from "@prisma/client";

/**
 * Comped plans: Silver or Gold given to a handicapper from the admin panel for
 * a fixed period, free of charge, falling back to Free when it runs out.
 *
 * THE SHAPE OF THE PROBLEM. A comp looks like a plan but is not a
 * subscription: nobody is billed, Stripe knows nothing about it, and it ends
 * on a date rather than renewing. The temptation is to express it by simply
 * setting `plan` — which is what the admin panel used to do — and that loses
 * the two facts that matter: when it ends, and that it was a gift rather than
 * something the handicapper bought. Both live in the planComped* columns.
 *
 * The four rules below were decided deliberately; each one exists because the
 * obvious alternative does something unkind to a real person.
 */

/** How long before a comp ends that we warn them. */
export const COMP_WARNING_DAYS = 3;

/** A comp shorter than this gets no warning — see `shouldWarn`. */
export const MIN_DAYS_FOR_WARNING = COMP_WARNING_DAYS;

export type CompPlan = Extract<HandicapperPlan, "SILVER" | "GOLD">;
export const COMP_PLANS: CompPlan[] = ["SILVER", "GOLD"];

export function isCompPlan(plan: string): plan is CompPlan {
  return plan === "SILVER" || plan === "GOLD";
}

/** The plan-billing fields this module reasons about. */
export interface PlanState {
  plan: HandicapperPlan;
  planStripeSubscriptionId: string | null;
  planCompedUntil: Date | null;
}

/**
 * RULE 1 — someone already paying cannot be comped.
 *
 * Writing a comp over a live Stripe subscription would leave them paying for a
 * plan they were given, with the comp's expiry later dropping a paying
 * customer to Free. Extending an existing comp is fine; that is not billing.
 */
export function canBeComped(state: PlanState): boolean {
  return state.planStripeSubscriptionId === null;
}

export function whyNotComped(state: PlanState): string | null {
  if (canBeComped(state)) return null;
  return `Already paying for ${PLAN_DEFINITIONS[state.plan].label} through Stripe. Cancel that subscription first, or leave it — a comp would mean paying for a plan they were given.`;
}

/** Whether a comp is currently running. */
export function hasActiveComp(state: PlanState, now: Date = new Date()): boolean {
  return state.planCompedUntil !== null && state.planCompedUntil.getTime() > now.getTime();
}

/**
 * RULE 3 — a comp shorter than the warning window gets no warning.
 *
 * "Three days left" arriving on day one of a two-day comp reads as broken, and
 * an email that contradicts itself costs more trust than the reminder buys.
 * Such a comp still gets the grant and the expiry.
 */
export function shouldWarn(grantedAt: Date, endsAt: Date): boolean {
  const days = (endsAt.getTime() - grantedAt.getTime()) / 86_400_000;
  return days >= MIN_DAYS_FOR_WARNING;
}

/** The moment a comp's warning is due. */
export function warningDueAt(endsAt: Date): Date {
  return new Date(endsAt.getTime() - COMP_WARNING_DAYS * 86_400_000);
}

export type GrantResult =
  | { ok: true; plan: CompPlan; endsAt: Date; warned: boolean }
  | { ok: false; reason: string };

/**
 * Give a handicapper a plan until `endsAt`, and tell them.
 *
 * RULE 2 — this never touches `planTrialUsed`. That flag is the handicapper's
 * one-time free month on a paid plan, and it is theirs to spend. A gift from
 * an admin quietly consuming it would take away something they never chose to
 * use, and they would only discover it later when the trial they expected
 * wasn't offered.
 */
export async function grantCompedPlan(opts: {
  handicapperId: string;
  plan: CompPlan;
  endsAt: Date;
  grantedById: string;
  now?: Date;
}): Promise<GrantResult> {
  const now = opts.now ?? new Date();
  if (opts.endsAt.getTime() <= now.getTime()) {
    return { ok: false, reason: "That end date is in the past." };
  }

  const profile = await prisma.handicapperProfile.findUnique({
    where: { id: opts.handicapperId },
    select: {
      plan: true,
      planStripeSubscriptionId: true,
      planCompedUntil: true,
      displayName: true,
      user: { select: { email: true } },
    },
  });
  if (!profile) return { ok: false, reason: "No such handicapper." };

  const refusal = whyNotComped(profile);
  if (refusal) return { ok: false, reason: refusal };

  await prisma.handicapperProfile.update({
    where: { id: opts.handicapperId },
    data: {
      plan: opts.plan,
      planStatus: "ACTIVE",
      planCompedUntil: opts.endsAt,
      planCompedAt: now,
      planCompedById: opts.grantedById,
      // A fresh grant — or an extension — earns a fresh warning. Without this,
      // extending a comp that had already warned would run to its new end date
      // in silence.
      planCompWarnedAt: null,
      // planTrialUsed is deliberately untouched (rule 2).
    },
  });

  const warned = shouldWarn(now, opts.endsAt);
  await sendCompEmail("granted", {
    email: profile.user.email,
    plan: opts.plan,
    endsAt: opts.endsAt,
    willWarn: warned,
  });

  return { ok: true, plan: opts.plan, endsAt: opts.endsAt, warned };
}

/**
 * End a comp now and return the handicapper to Free.
 *
 * Used both by the daily sweep when a comp runs out and by an admin revoking
 * one early. `notify` is false for a revocation an admin makes by hand — the
 * expiry email says the plan "ran out", which is not what happened.
 */
export async function endCompedPlan(opts: {
  handicapperId: string;
  notify: boolean;
  now?: Date;
}): Promise<boolean> {
  const profile = await prisma.handicapperProfile.findUnique({
    where: { id: opts.handicapperId },
    select: {
      plan: true,
      planStripeSubscriptionId: true,
      planCompedUntil: true,
      user: { select: { email: true } },
    },
  });
  if (!profile || profile.planCompedUntil === null) return false;

  // RULE 4 — they started paying, so nothing is expiring.
  //
  // Between the warning and the expiry they may have subscribed for real. The
  // comp is over either way, but the plan is not: clear the comp, leave the
  // plan they are now paying for alone, and send nothing. Telling a paying
  // customer their plan has ended is how a support ticket gets written.
  const startedPaying = profile.planStripeSubscriptionId !== null;

  await prisma.handicapperProfile.update({
    where: { id: opts.handicapperId },
    data: {
      ...(startedPaying ? {} : { plan: "FREE", planStatus: "ACTIVE" }),
      planCompedUntil: null,
      planCompedAt: null,
      planCompedById: null,
      planCompWarnedAt: null,
    },
  });

  if (opts.notify && !startedPaying) {
    await sendCompEmail("ended", {
      email: profile.user.email,
      plan: profile.plan === "FREE" ? "SILVER" : (profile.plan as CompPlan),
      endsAt: profile.planCompedUntil,
    });
  }
  return true;
}

export interface SweepReport {
  warned: number;
  expired: number;
  skippedPaying: number;
  errors: string[];
}

/**
 * One daily pass: warn the comps about to end, end the ones that have.
 *
 * Ordering matters. Expiries run first so a comp that ended overnight is not
 * also sent a "three days left" note in the same pass — which can happen when
 * a run is missed and two days' work lands at once.
 */
export async function sweepCompedPlans(now: Date = new Date()): Promise<SweepReport> {
  const report: SweepReport = { warned: 0, expired: 0, skippedPaying: 0, errors: [] };

  const ended = await prisma.handicapperProfile.findMany({
    where: { planCompedUntil: { not: null, lte: now } },
    select: { id: true, planStripeSubscriptionId: true },
  });
  for (const profile of ended) {
    try {
      if (profile.planStripeSubscriptionId !== null) report.skippedPaying += 1;
      await endCompedPlan({ handicapperId: profile.id, notify: true, now });
      report.expired += 1;
    } catch (err) {
      report.errors.push(`expire ${profile.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const dueBy = new Date(now.getTime() + COMP_WARNING_DAYS * 86_400_000);
  const ending = await prisma.handicapperProfile.findMany({
    where: {
      planCompedUntil: { not: null, gt: now, lte: dueBy },
      planCompWarnedAt: null,
    },
    select: {
      id: true,
      plan: true,
      planCompedAt: true,
      planCompedUntil: true,
      planStripeSubscriptionId: true,
      user: { select: { email: true } },
    },
  });
  for (const profile of ending) {
    const endsAt = profile.planCompedUntil!;
    try {
      // Rule 4 again, one step earlier: if they have already subscribed, there
      // is nothing to warn them about.
      if (profile.planStripeSubscriptionId !== null) {
        report.skippedPaying += 1;
        await prisma.handicapperProfile.update({
          where: { id: profile.id },
          data: { planCompWarnedAt: now },
        });
        continue;
      }
      // Rule 3: a comp too short to have a warning window never gets one. The
      // stamp is still written so the row stops being looked at every day.
      //
      // A row with no grant timestamp — hand-edited, or from before this
      // feature — is warned rather than skipped. Defaulting the other way
      // would read every such comp as zero days long and silently swallow the
      // warning, and a missing warning is the failure that costs someone their
      // plan without notice.
      if (profile.planCompedAt && !shouldWarn(profile.planCompedAt, endsAt)) {
        await prisma.handicapperProfile.update({
          where: { id: profile.id },
          data: { planCompWarnedAt: now },
        });
        continue;
      }
      await sendCompEmail("ending", {
        email: profile.user.email,
        plan: isCompPlan(profile.plan) ? profile.plan : "SILVER",
        endsAt,
      });
      await prisma.handicapperProfile.update({
        where: { id: profile.id },
        data: { planCompWarnedAt: now },
      });
      report.warned += 1;
    } catch (err) {
      report.errors.push(`warn ${profile.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return report;
}

/**
 * Send one of the three. Mail failure never propagates: a comp that was
 * granted stays granted even if the mail bounces, and a sweep does not abandon
 * the rest of its work because one address is dead.
 */
async function sendCompEmail(
  kind: "granted" | "ending" | "ended",
  opts: { email: string; plan: CompPlan; endsAt: Date; willWarn?: boolean }
): Promise<void> {
  const label = PLAN_DEFINITIONS[opts.plan].label;
  try {
    if (kind === "granted") {
      await sendEmail({
        to: opts.email,
        subject: `You're on ${label} until ${monthDay(opts.endsAt)}`,
        html: compGrantedEmailHtml(opts.plan, opts.endsAt, opts.willWarn ?? true),
        text: compGrantedEmailText(opts.plan, opts.endsAt, opts.willWarn ?? true),
      });
    } else if (kind === "ending") {
      await sendEmail({
        to: opts.email,
        subject: `Your ${label} plan ends on ${monthDay(opts.endsAt)}`,
        html: compEndingEmailHtml(opts.plan, opts.endsAt),
        text: compEndingEmailText(opts.plan, opts.endsAt),
      });
    } else {
      await sendEmail({
        to: opts.email,
        subject: `Your ${label} plan has ended`,
        html: compEndedEmailHtml(opts.plan, opts.endsAt),
        text: compEndedEmailText(opts.plan, opts.endsAt),
      });
    }
  } catch (err) {
    console.error(`[comped-plans] ${kind} email to ${opts.email} failed:`, err);
  }
}

/** `11 October` — the subject-line form, where the year is noise. */
function monthDay(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" }).format(d);
}
