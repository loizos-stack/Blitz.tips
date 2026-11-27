import "server-only";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { canStripePayout, countryCode } from "@/lib/countries";
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

export type ConnectStatus = {
  ready: boolean;
  /** Null once a dead account has been cleared — i.e. there is nothing to resume. */
  accountId: string | null;
  /**
   * The account's own country, which Stripe fixed when it was created and will
   * never change. The payouts page prefills the country picker with it so that
   * resuming an unfinished account doesn't silently offer a different one.
   */
  country: string | null;
};

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
export async function syncConnectStatus(handicapper: HandicapperProfile): Promise<ConnectStatus> {
  if (!handicapper.stripeAccountId) return { ready: false, accountId: null, country: null };
  try {
    const account = await stripe.accounts.retrieve(handicapper.stripeAccountId);
    const ready = Boolean(account.charges_enabled && account.details_submitted);
    if (ready !== handicapper.stripeAccountReady) {
      await prisma.handicapperProfile.update({
        where: { id: handicapper.id },
        data: { stripeAccountReady: ready },
      });
    }
    return { ready, accountId: account.id, country: account.country ?? null };
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
      return { ready: false, accountId: null, country: null };
    }
    console.error("Connect status sync failed:", error);
    return {
      ready: handicapper.stripeAccountReady,
      accountId: handicapper.stripeAccountId,
      country: null,
    };
  }
}

export type ConnectBannerState = {
  ready: boolean;
  resume: boolean;
  /** Code to prefill the country picker with, or "" to make them choose. */
  defaultCountry: string;
  /** Their signup country's name, when Stripe can't pay out to it. */
  unsupportedCountry: string | null;
};

/**
 * Everything the Connect banner needs, including which country to start its
 * picker on.
 *
 * This lives here rather than in either page because both the onboarding
 * wizard's payments step and the dashboard's payouts section render that
 * banner, and getting the country wrong in one of them is the bug this whole
 * change exists to fix: Stripe fixes a connected account's country when it is
 * created and never lets it change, so a page that forgets to prefill hands
 * the handicapper an account they cannot finish.
 *
 * An existing account's own country always wins — resuming it anywhere else is
 * impossible. Otherwise the self-reported signup country, but only when Stripe
 * can actually pay out there; an ineligible one is reported separately so the
 * banner can point at crypto instead of quietly starting them on nothing.
 */
export async function connectBannerState(
  handicapper: HandicapperProfile
): Promise<ConnectBannerState> {
  const connect = handicapper.stripeAccountId
    ? await syncConnectStatus(handicapper)
    : { ready: false, accountId: null, country: null };

  const user = await prisma.user.findUnique({
    where: { id: handicapper.userId },
    select: { country: true },
  });
  const signupCountry = countryCode(user?.country);
  const eligible = canStripePayout(signupCountry);

  return {
    ready: connect.ready,
    resume: Boolean(connect.accountId),
    defaultCountry: connect.country?.toUpperCase() ?? (eligible ? signupCountry! : ""),
    unsupportedCountry: !connect.country && signupCountry && !eligible ? user!.country : null,
  };
}
