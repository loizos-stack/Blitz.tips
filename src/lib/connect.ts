import "server-only";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import type { HandicapperProfile } from "@prisma/client";

/**
 * True when a Stripe error means the stored connected account doesn't exist for
 * the current API key — most commonly a test/sandbox account referenced after
 * switching to live keys. Such accounts must be cleared so the handicapper can
 * reconnect fresh.
 */
export function isMissingAccountError(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  const message = (error as { message?: string })?.message ?? "";
  return code === "resource_missing" || code === "account_invalid" || /no such account/i.test(message);
}

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
    // A stored account that no longer exists for the current key (e.g. a
    // test-mode account after going live) is cleared so the handicapper can
    // reconnect from scratch rather than being stuck.
    if (isMissingAccountError(error)) {
      await prisma.handicapperProfile
        .update({
          where: { id: handicapper.id },
          data: { stripeAccountId: null, stripeAccountReady: false },
        })
        .catch(() => undefined);
      return false;
    }
    console.error("Connect status sync failed:", error);
    return handicapper.stripeAccountReady;
  }
}
