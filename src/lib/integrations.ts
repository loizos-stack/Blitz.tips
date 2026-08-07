import "server-only";
import { blobConfigured } from "@/lib/blob";

/**
 * Which optional integrations are actually wired up in the environment this
 * server is running in.
 *
 * Nearly every integration here degrades silently by design — a missing
 * SPORTSDB_API_KEY shows sport icons instead of crests, a missing
 * THE_ODDS_API_KEY hides the board, a missing RESEND_API_KEY drops email on the
 * floor. That is the right runtime behaviour, but it makes a misconfiguration
 * invisible: the site looks fine and quietly does less. This turns that into
 * something you can read off a page.
 *
 * It reports only whether a variable is non-empty. No values, no prefixes, no
 * lengths — nothing that narrows a secret for anyone who reaches the page.
 * A set-but-invalid key is indistinguishable from a working one here; this
 * answers "is it plugged in", not "does it work".
 */

/** Non-empty after trimming. A whitespace-only value is a missing one. */
function set(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

export type IntegrationState = "ok" | "partial" | "off";

export interface IntegrationVar {
  name: string;
  set: boolean;
  /** False for vars the integration works without (aliases, tuning knobs). */
  required: boolean;
}

export interface Integration {
  key: string;
  label: string;
  /** What the site does when this isn't configured. */
  fallback: string;
  /** True when the site is broken without it, rather than merely reduced. */
  critical: boolean;
  vars: IntegrationVar[];
  state: IntegrationState;
}

function build(
  key: string,
  label: string,
  fallback: string,
  critical: boolean,
  vars: IntegrationVar[]
): Integration {
  const required = vars.filter((v) => v.required);
  const on = required.filter((v) => v.set).length;
  // Partial is the state worth surfacing loudly: half-configured integrations
  // fail at the moment they're used rather than at boot, which is how a webhook
  // secret goes missing for a month without anyone noticing.
  const state: IntegrationState = on === 0 ? "off" : on === required.length ? "ok" : "partial";
  return { key, label, fallback, critical, vars, state };
}

const req = (name: string, value: string | undefined): IntegrationVar => ({
  name,
  set: set(value),
  required: true,
});
const opt = (name: string, value: string | undefined): IntegrationVar => ({
  name,
  set: set(value),
  required: false,
});

/**
 * The environment this server is running in — the answer to "I set the key, why
 * is it still not working", which is nearly always a variable scoped to Preview
 * but not Production.
 */
export function deploymentEnv(): string {
  return process.env.VERCEL_ENV?.trim() || process.env.NODE_ENV || "unknown";
}

export function integrationStatus(): Integration[] {
  return [
    build("database", "Database", "The site cannot run.", true, [
      req("DATABASE_URL", process.env.DATABASE_URL),
    ]),

    build("auth", "Authentication", "Nobody can sign in.", true, [
      req("AUTH_SECRET", process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET),
      opt("AUTH_GOOGLE_ID", process.env.AUTH_GOOGLE_ID),
      opt("AUTH_GOOGLE_SECRET", process.env.AUTH_GOOGLE_SECRET),
    ]),

    build(
      "stripe",
      "Stripe",
      "Card subscriptions and handicapper payouts are unavailable.",
      true,
      [
        req("STRIPE_SECRET_KEY", process.env.STRIPE_SECRET_KEY),
        req("STRIPE_WEBHOOK_SECRET", process.env.STRIPE_WEBHOOK_SECRET),
      ]
    ),

    build("email", "Email (Resend)", "No email is sent — including verification.", true, [
      req("RESEND_API_KEY", process.env.RESEND_API_KEY),
      opt("EMAIL_FROM", process.env.EMAIL_FROM),
      opt("CONTACT_EMAIL", process.env.CONTACT_EMAIL),
    ]),

    build("odds", "The Odds API", "Today's lines is hidden; picks fall back to manual entry.", false, [
      req(
        "THE_ODDS_API_KEY",
        process.env.THE_ODDS_API_KEY ?? process.env.ODDS_API_KEY ?? process.env.THEODDS_API_KEY
      ),
      opt("MAX_SOCCER_LEAGUES", process.env.MAX_SOCCER_LEAGUES),
    ]),

    build(
      "sportsdb",
      "TheSportsDB",
      "Soccer, college, UFC and tennis show a sport icon instead of a crest. US major-league crests are unaffected — those come from a built-in table.",
      false,
      [req("SPORTSDB_API_KEY", process.env.SPORTSDB_API_KEY ?? process.env.THESPORTSDB_API_KEY)]
    ),

    build("crypto", "NOWPayments", "Crypto checkout is unavailable; card payment still works.", false, [
      req("NOWPAYMENTS_API_KEY", process.env.NOWPAYMENTS_API_KEY),
      req("NOWPAYMENTS_IPN_SECRET", process.env.NOWPAYMENTS_IPN_SECRET),
    ]),

    // Reported via blobToken() rather than by reading BLOB_READ_WRITE_TOKEN
    // directly: connecting a store with a custom env-prefix yields
    // MYSTORE_READ_WRITE_TOKEN, which uploads accept and a name-based check
    // would call missing.
    build("blob", "Vercel Blob", "Profile and cover image uploads fail.", false, [
      { name: "BLOB_READ_WRITE_TOKEN (or any *_READ_WRITE_TOKEN)", set: blobConfigured(), required: true },
    ]),

    build(
      "ai",
      "Anthropic (chat assistant, parlay OCR)",
      "Live chat answers from the canned FAQ only, and parlay screenshots are read by Tesseract instead of Claude vision.",
      false,
      [req("ANTHROPIC_API_KEY", process.env.ANTHROPIC_API_KEY)]
    ),

    // NEXT_PUBLIC_VAPID_PUBLIC_KEY is optional, not required. Nothing reads it
    // in the browser bundle — push-client fetches the key from
    // GET /api/push/subscribe, which serves VAPID_PUBLIC_KEY. It survives only
    // as a server-side fallback in lib/push, so listing it as required
    // reported push as broken while it was working.
    build("push", "Web push", "Browser push notifications are unavailable; email still sends.", false, [
      req("VAPID_PUBLIC_KEY", process.env.VAPID_PUBLIC_KEY),
      req("VAPID_PRIVATE_KEY", process.env.VAPID_PRIVATE_KEY),
      opt("NEXT_PUBLIC_VAPID_PUBLIC_KEY", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      opt("VAPID_SUBJECT", process.env.VAPID_SUBJECT),
    ]),

    // META_PAGE_ID is optional-but-load-bearing: reporting works without it,
    // creating an ad does not (a creative has to run from a Page). Reported as
    // optional so a read-only setup isn't flagged broken.
    build(
      "meta-ads",
      "Meta Ads",
      "The Ads tab can't reach Meta; campaign reporting and ad creation are unavailable.",
      false,
      [
        req("META_ADS_ACCESS_TOKEN", process.env.META_ADS_ACCESS_TOKEN),
        req("META_AD_ACCOUNT_ID", process.env.META_AD_ACCOUNT_ID),
        opt("META_PAGE_ID", process.env.META_PAGE_ID),
        opt("META_MAX_DAILY_BUDGET", process.env.META_MAX_DAILY_BUDGET),
      ]
    ),

    build(
      "cron",
      "Scheduled jobs",
      "Cron routes reject scheduled callers, so auto-settlement and the weekly digest never run.",
      false,
      [req("CRON_SECRET", process.env.CRON_SECRET)]
    ),
  ];
}
