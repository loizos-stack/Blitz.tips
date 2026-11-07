import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { isMissingAccountError } from "@/lib/connect";
import { canStripePayout, countryCode, countryName } from "@/lib/countries";
import { ensureSubscriberPrices } from "@/lib/subscriber-pricing";
import { siteUrl } from "@/lib/site";

const appUrl = siteUrl();

/** What to tell someone whose country Stripe can't reach from this platform. */
function noStripeInCountry(label: string) {
  return NextResponse.json(
    {
      error: `Stripe payouts aren't available in ${label}. Add a BTC or ETH payout address below instead — crypto payouts have no country restrictions, and your subscribers can still pay by card.`,
      cryptoOnly: true,
    },
    { status: 400 }
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const handicapper = await prisma.handicapperProfile.findUnique({ where: { userId: session.user.id } });
  if (!handicapper) return NextResponse.json({ error: "No handicapper profile" }, { status: 404 });

  // The country of the connected account. Stripe fixes this at creation and
  // never lets it change, so it has to be right the first time — and left to
  // itself Stripe defaults it to the *platform's* country (Cyprus), which is
  // how every account on the platform ended up Cypriot and unfinishable. The
  // handicapper confirms it in the dashboard before we create anything; their
  // self-reported signup country only prefills that box.
  const body = await request.json().catch(() => ({}));
  const requested = typeof body?.country === "string" ? body.country.trim().toUpperCase() : "";
  const country = requested || countryCode(
    (await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { country: true },
    }))?.country
  );

  if (!country) {
    return NextResponse.json(
      { error: "Choose the country your bank account is in before connecting Stripe.", needsCountry: true },
      { status: 400 }
    );
  }
  if (!canStripePayout(country)) {
    return noStripeInCountry(countryName(country));
  }

  let accountId = handicapper.stripeAccountId;

  if (accountId) {
    let existing: Stripe.Account | null = null;
    try {
      existing = await stripe.accounts.retrieve(accountId);
    } catch (error) {
      // A stored account that no longer exists for the current key (e.g. a
      // test-mode account after switching to live keys) would make the link
      // creation below fail. Drop it so a fresh account is created instead.
      if (isMissingAccountError(error)) {
        accountId = null;
        await prisma.handicapperProfile.update({
          where: { id: handicapper.id },
          data: { stripeAccountId: null, stripeAccountReady: false },
        });
      }
    }

    // An account in the wrong country is a dead end: the handicapper is asked
    // for an ID and a bank account from a country they aren't in, and country
    // is immutable, so no amount of resuming fixes it. Replace it — but only
    // while it is still empty, so a finished account is never touched.
    const untouched =
      existing &&
      !existing.details_submitted &&
      !existing.charges_enabled &&
      !existing.payouts_enabled;
    if (existing && existing.country !== country && untouched) {
      // Best-effort: Stripe refuses to delete an account holding a balance,
      // and an orphan left behind in the dashboard is harmless. What matters
      // is that the profile stops pointing at it.
      await stripe.accounts.del(accountId!).catch((error) => {
        console.error("Could not delete the wrong-country Connect account:", error);
      });
      accountId = null;
      await prisma.handicapperProfile.update({
        where: { id: handicapper.id },
        data: { stripeAccountId: null, stripeAccountReady: false },
      });
    }
  }

  try {
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country,
        email: session.user.email ?? undefined,
        business_type: "individual",
        // Request both card_payments and transfers. We use destination charges
        // (the platform is merchant of record), which technically only needs
        // transfers — but Stripe requires special platform approval to request
        // transfers *without* card_payments, so we request the standard pair to
        // avoid that gate. Having card_payments doesn't change our charge flow.
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { handicapperId: handicapper.id, handle: handicapper.handle },
      });
      accountId = account.id;
      await prisma.handicapperProfile.update({
        where: { id: handicapper.id },
        data: { stripeAccountId: accountId },
      });
    }
  } catch (error) {
    // Surface the real reason (e.g. "Connect is not enabled" or a missing key)
    // so it's actionable rather than a generic failure.
    console.error(`Stripe Connect account creation failed (country=${country}):`, error);
    const message =
      error instanceof Error ? error.message : "Couldn't start Stripe onboarding.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Ensure Stripe Prices exist for every offered package — they may be
  // missing if Stripe was unavailable at profile creation or a package was
  // just added/changed. Doing it here means that by the time onboarding
  // completes, subscriptions can be enabled.
  try {
    await ensureSubscriberPrices(handicapper);
  } catch (error) {
    console.error("Failed to ensure subscriber prices during Connect setup:", error);
  }

  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      // Return to the Payouts section, which self-heals the Connect status on
      // load (the account.updated webhook is best-effort). Markers let it show
      // the right state and force a sync on return / expired-link resume.
      refresh_url: `${appUrl}/dashboard/handicapper/payouts?connect=refresh`,
      return_url: `${appUrl}/dashboard/handicapper/payouts?connect=return`,
      type: "account_onboarding",
    });
    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    console.error("Stripe account link creation failed:", error);
    const message =
      error instanceof Error ? error.message : "Couldn't start Stripe onboarding.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
