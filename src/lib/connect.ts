import "server-only";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import type { HandicapperProfile } from "@prisma/client";

/**
 * Pull the live Connect account state from Stripe and sync stripeAccountReady.
 *
 * The webhook (`account.updated`) is the primary signal, but it silently does
 * nothing when the endpoint isn't configured or the secret mismatches — the
 * classic "finished onboarding but still shows Connect Stripe" bug. Calling
 * this on dashboard load for not-yet-ready accounts makes the flow
 * self-healing. Best-effort: returns the current DB value if Stripe is
 * unreachable.
 */
export async function syncConnectStatus(handicapper: HandicapperProfile): Promise<boolean> {
  if (!handicapper.stripeAccountId) return false;
  try {
    const account = await stripe.accounts.retrieve(handicapper.stripeAccountId);
    const ready = Boolean(account.charges_enabled && account.details_submitted);
    if (ready !== handicapper.stripeAccountReady) {
      await prisma.handicapperProfile.update({
        where: { id: handicapper.id },
        data: { stripeAccountReady: ready },
      });
    }
    return ready;
  } catch (error) {
    console.error("Connect status sync failed:", error);
    return handicapper.stripeAccountReady;
  }
}
