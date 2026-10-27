import { z } from "zod";

// Login username: 3–20 chars, letters/numbers/underscore. Normalized to
// lowercase so uniqueness and sign-in are case-insensitive. Shared by the
// registration form and the Google-onboarding basics step.
export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be at most 20 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Use only letters, numbers, and underscores")
  .transform((s) => s.toLowerCase());

// Editing your own account (username is immutable, so it's not here). Email is
// re-validated + uniqueness-checked in the route.
export const accountProfileSchema = z.object({
  name: z.string().min(2, "Name is too short").max(60),
  email: z.email("Enter a valid email"),
  country: z.string().min(2, "Select your country").max(60).optional().or(z.literal("")),
});

// Change/set a password. currentPassword is required only when the account
// already has one (Google-only accounts set their first password with none).
export const passwordChangeSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

// Ask for a reset link. Nothing but the address — no current password, since
// the whole point is that it is unavailable.
export const passwordResetRequestSchema = z.object({
  email: z.email("Enter a valid email"),
});

// Set a new password from an emailed link. The token identifies the account, so
// no email is submitted alongside it: accepting one would invite a request that
// names a different account than the token belongs to.
export const passwordResetSchema = z.object({
  token: z.string().min(1, "This reset link is missing its token"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Name is too short").max(60),
  username: usernameSchema,
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  country: z.string().min(2, "Select your country").max(60).optional(),
});

export const updateSportsSchema = z.object({
  sports: z.array(z.string()).min(1, "Pick at least one sport"),
});

// American odds bounds for a single selection. The ceiling matters: profit on a
// winner is units x (odds / 100), so an unbounded positive price lets one pick
// manufacture an arbitrarily large unit/ROI figure and take over the leaderboard
// or a contest prize pool. +10000 (100/1) is well beyond any real single-market
// price; the floor is generous because negative odds can only shrink profit.
// (A parlay's combined price is computed server-side from its legs and is
// intentionally not bound by this — see combineParlayOdds.)
export const MAX_POSITIVE_ODDS = 10000;
export const MIN_NEGATIVE_ODDS = -100000;

/**
 * Decimal odds as American odds, for the hint below.
 *
 * 2.50 → +150, 1.91 → −110. Rounded, because American odds are whole numbers
 * and the point is to show the person the number to type.
 */
function decimalToAmerican(decimal: number): number {
  return decimal >= 2
    ? Math.round((decimal - 1) * 100)
    : -Math.round(100 / (decimal - 1));
}

/** The shape of a decimal price: between evens and a longshot, with a fraction. */
function looksLikeDecimalOdds(v: number): boolean {
  return v > 1 && v < 101 && !Number.isInteger(v);
}

const boundedOdds = z.number().superRefine((v, ctx) => {
  // A whole number is what American odds are. This check used to be a bare
  // `.int()`, whose message is "Invalid input: expected int, received number" —
  // which told a real customer nothing, did not name the field, and sent them
  // asking what to put in Units. Someone typing a decimal price is not making
  // a type error, they are using the odds format their country uses, so the
  // message says which format this site wants and what their number is in it.
  if (!Number.isInteger(v)) {
    ctx.addIssue(
      looksLikeDecimalOdds(v)
        ? `Odds are in American format here, so they're whole numbers. ${v} in decimal odds is ${decimalToAmerican(v) > 0 ? "+" : ""}${decimalToAmerican(v)} — enter that.`
        : "Odds must be a whole number, like -110 or +150."
    );
    return;
  }
  if (v === 0 || (v > -100 && v < 100)) {
    ctx.addIssue("Odds must be +100 or longer, or -100 or shorter (American format).");
    return;
  }
  if (v > MAX_POSITIVE_ODDS || v < MIN_NEGATIVE_ODDS) {
    ctx.addIssue(`Odds must be between ${MIN_NEGATIVE_ODDS} and +${MAX_POSITIVE_ODDS}.`);
  }
});

// A single pick submitted into a handicapping contest (Supercapper). Contest
// picks are always taken from our own odds board, so the entrant identifies the
// game and the line and the server resolves everything else from the feed —
// matchup, bet type, price and start time are never trusted from the client.
// `odds` is still sent so the server can confirm the price the entrant saw is
// the price still offered (and reject the pick if the line has moved).
export const createContestPickSchema = z.object({
  sport: z.string(),
  oddsApiEventId: z.string().min(1, "Pick a game from the board").max(64),
  selection: z.string().min(1).max(140),
  odds: boundedOdds,
  // Messages spelled out: the defaults read "Too small: expected number to
  // be >=0.1", which is a sentence written for whoever wrote the schema.
  units: z
    .number()
    .min(0.1, "Units must be at least 0.1.")
    .max(20, "Units can be at most 20."),
});

export const becomeHandicapperSchema = z.object({
  handle: z
    .string()
    .min(3, "Handle must be at least 3 characters")
    .max(24, "Handle must be 24 characters or fewer")
    .regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers, and underscores only"),
  displayName: z.string().min(2).max(60),
  bio: z.string().max(1000).optional(),
  sports: z.array(z.string()).min(1, "Pick at least one sport"),
  monthlyPriceCents: z
    .number()
    .int()
    .min(499, "Minimum price is $4.99")
    .max(99999, "Max price is $999.99"),
  weeklyPriceCents: z
    .number()
    .int()
    .min(199, "Minimum weekly price is $1.99")
    .max(99999, "Max price is $999.99")
    .nullish(),
  annualPriceCents: z
    .number()
    .int()
    .min(999, "Minimum annual price is $9.99")
    .max(999999, "Max annual price is $9,999.99")
    .nullish(),
  // Free-trial length for weekly/monthly packages: 0 (none), 1, or 2 days.
  subscriptionTrialDays: z.number().int().min(0).max(2, "Trials can be at most 2 days").nullish(),
  // Currency the packages are priced/charged in.
  priceCurrency: z.enum(["USD", "EUR", "GBP"]).optional(),
});

// Crypto payout wallets (internal — where the platform sends the handicapper's
// cut). Each is optional; loose format checks catch obvious typos.
export const payoutWalletsSchema = z.object({
  payoutEthAddress: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Enter a valid ETH (ERC-20) address")
    .or(z.literal(""))
    .nullish(),
  payoutBtcAddress: z
    .string()
    .trim()
    .regex(/^(bc1[a-z0-9]{20,90}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/, "Enter a valid BTC address")
    .or(z.literal(""))
    .nullish(),
});

// Dashboard price updates share the same package constraints.
export const updatePricingSchema = becomeHandicapperSchema.pick({
  monthlyPriceCents: true,
  weeklyPriceCents: true,
  annualPriceCents: true,
  subscriptionTrialDays: true,
  priceCurrency: true,
});

export const createPickSchema = z.object({
  sport: z.string(),
  league: z.string().max(60).optional(),
  matchup: z.string().min(2).max(140),
  betType: z.string(),
  selection: z.string().min(1).max(140),
  odds: boundedOdds,
  units: z
    .number()
    .min(0.1, "Units must be at least 0.1.")
    .max(20, "Units can be at most 20."),
  analysis: z.string().max(2000).optional(),
  isPremium: z.boolean().default(true),
  eventStartsAt: z.string().min(1, "Event start time is required"),
  oddsApiEventId: z.string().max(64).optional(),
  oddsApiSportKey: z.string().max(64).optional(),
  // Structured line, sent when the pick was chosen off the odds board. Optional
  // because manual entry stays supported for handicappers.
  marketKey: z.string().max(64).optional(),
  side: z.string().max(120).optional(),
  linePoint: z.number().optional(),
  playerName: z.string().max(120).optional(),
});

const oddsValue = boundedOdds;

export const parlayLegSchema = z.object({
  sport: z.string().optional(),
  league: z.string().max(60).optional(),
  matchup: z.string().min(2).max(140),
  selection: z.string().min(1).max(140),
  odds: oddsValue,
  oddsApiEventId: z.string().max(64).optional(),
  oddsApiSportKey: z.string().max(64).optional(),
});

export const createParlaySchema = z.object({
  sport: z.string(),
  units: z
    .number()
    .min(0.1, "Units must be at least 0.1.")
    .max(20, "Units can be at most 20."),
  analysis: z.string().max(2000).optional(),
  isPremium: z.boolean().default(true),
  eventStartsAt: z.string().min(1, "Event start time is required"),
  legs: z.array(parlayLegSchema).min(2, "A parlay needs at least 2 legs").max(12),
});

export const settlePickSchema = z.object({
  result: z.enum(["WIN", "LOSS", "PUSH", "VOID", "PENDING"]),
});

/**
 * Turn a validation failure into something the person who filled the form can
 * act on.
 *
 * The routes used to answer with `error.issues[0].message` and nothing else.
 * That is fine while every message is hand-written, and silently awful the
 * moment one isn't: a customer hit Zod's own "Invalid input: expected int,
 * received number", had no idea which of eight inputs it meant, and wrote in
 * asking what to put in the Units box. The field was Odds.
 *
 * So the field name is always included, and anything that still reads like a
 * library's internal message is replaced rather than forwarded. The aim is
 * that nobody has to email to find out which box is wrong.
 */
const FIELD_LABELS: Record<string, string> = {
  odds: "Odds",
  units: "Units",
  selection: "Selection",
  matchup: "Matchup",
  sport: "Sport",
  betType: "Bet type",
  eventStartsAt: "Start time",
  analysis: "Analysis",
  handle: "Handle",
  displayName: "Display name",
  monthlyPriceCents: "Monthly price",
  weeklyPriceCents: "Weekly price",
  annualPriceCents: "Annual price",
  legs: "Parlay legs",
};

/** Zod's untranslated defaults, which should never reach a person. */
const LIBRARY_MESSAGE = /^(Invalid input|Too small|Too big|Invalid option|Required|Expected)\b/;

export function firstValidationError(error: z.ZodError, fallback = "Check the form and try again."): string {
  const issue = error.issues[0];
  if (!issue) return fallback;

  const key = issue.path.map(String).find((p) => p in FIELD_LABELS);
  const label = key ? FIELD_LABELS[key] : null;

  // A written message already says what is wrong; it only needs the field.
  if (!LIBRARY_MESSAGE.test(issue.message)) {
    return label && !issue.message.toLowerCase().startsWith(label.toLowerCase())
      ? `${label}: ${issue.message}`
      : issue.message;
  }

  // A library message says nothing useful, so say where the problem is and let
  // them look, rather than repeating jargon at them.
  return label
    ? `${label} isn't valid — check what you entered there.`
    : fallback;
}
