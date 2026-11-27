import "server-only";
import type Stripe from "stripe";
import type { HandicapperPlan, PriceCurrency } from "@prisma/client";
import { getSetting, setSetting } from "@/lib/settings";
import { commissionPercentForPlan } from "@/lib/plans";

/**
 * Taking card payment for a handicapper who has no Stripe account.
 *
 * The normal path is a Connect destination charge: Stripe splits the money as
 * it is taken and sends the handicapper's share to their own Stripe account.
 * It is the right design — the platform never holds anyone else's money — and
 * it has one requirement that turned out to be fatal in practice. The
 * handicapper has to finish Connect onboarding, and almost nobody does: of the
 * accounts started on this site, one is complete and the rest sit at
 * `details_submitted: false` with requirements past due. Those handicappers
 * could post picks and could not be paid, so their subscribe button showed
 * nothing at all.
 *
 * This is the other path. The charge lands whole in the platform's balance and
 * the handicapper's share becomes a debt the platform settles by hand — the
 * same arrangement the off-platform ("pay us directly") rail already uses, and
 * recorded in the same way, as a PlatformEarning discharged by a
 * HandicapperPayout.
 *
 * What that costs, written down because it is easy to forget once it works:
 * the platform is merchant of record for those sales, so a refund or
 * chargeback comes out of the platform's balance after the handicapper has
 * already been paid; the whole subscription is platform revenue for
 * accounting, with the payout an expense; and somebody has to actually send
 * the money. Connect remains the better path whenever a handicapper will
 * complete it, which is why nothing here discourages onboarding — a
 * handicapper who connects gets destination charges from their next
 * subscriber, automatically, with no migration.
 */

export const PLATFORM_COLLECT_KEY = "payments.platformCollect.enabled";

/**
 * Default ON: the whole reason this exists is that the site had one sellable
 * handicapper, and a feature that fixes that while switched off fixes nothing.
 * The switch exists so it can be turned OFF — if Stripe ever objects to the
 * arrangement, that is the lever, and it takes effect on the next checkout
 * without a deploy.
 */
export async function platformCollectEnabled(): Promise<boolean> {
  const raw = (await getSetting(PLATFORM_COLLECT_KEY))?.trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

export async function setPlatformCollectEnabled(enabled: boolean): Promise<void> {
  await setSetting(PLATFORM_COLLECT_KEY, enabled ? "1" : "0");
}

/**
 * Whether THIS handicapper's card sales are collected by the platform.
 *
 * Connect wins whenever it is available. A handicapper who has connected is
 * never routed through the manual rail, so switching this on cannot quietly
 * start holding money for people who were already being paid directly.
 */
export function collectsOnPlatform(
  handicapper: { stripeAccountReady: boolean; stripeAccountId: string | null },
  enabled: boolean
): boolean {
  if (handicapper.stripeAccountReady && handicapper.stripeAccountId) return false;
  return enabled;
}

/**
 * Split a collected amount into the platform's cut and what the handicapper is
 * owed, at the same commission their plan would have paid through Connect.
 *
 * Rounded so the two parts always add back to the whole: the commission is
 * rounded and the net is the remainder, rather than rounding both and leaving
 * a cent unaccounted for in either direction.
 */
export function splitCents(
  amountCents: number,
  plan: HandicapperPlan
): { commissionCents: number; netCents: number } {
  const commissionCents = Math.round((amountCents * commissionPercentForPlan(plan)) / 100);
  return { commissionCents, netCents: amountCents - commissionCents };
}

/** Stripe's three-letter code to the enum the ledger columns use. */
export function priceCurrencyOf(code: string | null | undefined): PriceCurrency {
  switch ((code ?? "").toLowerCase()) {
    case "eur":
      return "EUR";
    case "gbp":
      return "GBP";
    default:
      return "USD";
  }
}

/**
 * Which subscription an invoice belongs to.
 *
 * Two places carry it and neither is guaranteed. On this API version the
 * invoice itself has `parent.subscription_details.subscription`; the line item
 * has `parent.subscription_item_details.subscription` as well. A one-off
 * invoice has neither, and an invoice with no subscription is not a
 * subscription payment, so null is a real answer rather than a failure.
 *
 * Checked against a real `invoice.payment_failed` payload from this account
 * rather than from the field's name, because getting this wrong fails silently
 * — it would record nothing at all and the first anyone noticed would be a
 * handicapper asking where their money was.
 */
export function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const fromInvoice = invoice.parent?.subscription_details?.subscription;
  const fromLine = invoice.lines?.data?.[0]?.parent?.subscription_item_details?.subscription;
  const raw = fromInvoice ?? fromLine ?? null;
  if (!raw) return null;
  return typeof raw === "string" ? raw : raw.id;
}
