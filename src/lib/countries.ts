// Country names for the signup country picker. Kept as a plain list (self-
// reported, stored as-is) — a common subset covering the vast majority of
// users; "Other" catches the rest.
export const COUNTRIES: string[] = [
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Ireland",
  "New Zealand",
  "Germany",
  "France",
  "Spain",
  "Portugal",
  "Italy",
  "Netherlands",
  "Belgium",
  "Switzerland",
  "Austria",
  "Sweden",
  "Norway",
  "Denmark",
  "Finland",
  "Poland",
  "Czechia",
  "Greece",
  "Cyprus",
  "Malta",
  "Romania",
  "Bulgaria",
  "Hungary",
  "Croatia",
  "Serbia",
  "Ukraine",
  "Turkey",
  "Russia",
  "United Arab Emirates",
  "Saudi Arabia",
  "Israel",
  "India",
  "Pakistan",
  "Bangladesh",
  "China",
  "Japan",
  "South Korea",
  "Philippines",
  "Indonesia",
  "Malaysia",
  "Singapore",
  "Thailand",
  "Vietnam",
  "Mexico",
  "Brazil",
  "Argentina",
  "Chile",
  "Colombia",
  "Peru",
  "South Africa",
  "Nigeria",
  "Kenya",
  "Ghana",
  "Egypt",
  "Morocco",
  "Other",
];

/**
 * The two-letter code for each name above.
 *
 * `User.country` stores a *name* because that is what the signup dropdown
 * shows. Stripe wants ISO 3166-1 alpha-2, so anything that hands a country to
 * Stripe has to come through here. "Other" has no code on purpose — it means
 * the person's country isn't on the list, which is not the same as unknown.
 */
export const COUNTRY_CODES: Record<string, string> = {
  "United States": "US",
  "United Kingdom": "GB",
  Canada: "CA",
  Australia: "AU",
  Ireland: "IE",
  "New Zealand": "NZ",
  Germany: "DE",
  France: "FR",
  Spain: "ES",
  Portugal: "PT",
  Italy: "IT",
  Netherlands: "NL",
  Belgium: "BE",
  Switzerland: "CH",
  Austria: "AT",
  Sweden: "SE",
  Norway: "NO",
  Denmark: "DK",
  Finland: "FI",
  Poland: "PL",
  Czechia: "CZ",
  Greece: "GR",
  Cyprus: "CY",
  Malta: "MT",
  Romania: "RO",
  Bulgaria: "BG",
  Hungary: "HU",
  Croatia: "HR",
  Serbia: "RS",
  Ukraine: "UA",
  Turkey: "TR",
  Russia: "RU",
  "United Arab Emirates": "AE",
  "Saudi Arabia": "SA",
  Israel: "IL",
  India: "IN",
  Pakistan: "PK",
  Bangladesh: "BD",
  China: "CN",
  Japan: "JP",
  "South Korea": "KR",
  Philippines: "PH",
  Indonesia: "ID",
  Malaysia: "MY",
  Singapore: "SG",
  Thailand: "TH",
  Vietnam: "VN",
  Mexico: "MX",
  Brazil: "BR",
  Argentina: "AR",
  Chile: "CL",
  Colombia: "CO",
  Peru: "PE",
  "South Africa": "ZA",
  Nigeria: "NG",
  Kenya: "KE",
  Ghana: "GH",
  Egypt: "EG",
  Morocco: "MA",

  // Not on the signup list, but on the payout one. The signup dropdown is a
  // deliberately short list of the places our users actually come from; the
  // payout picker has to cover every country Stripe can send money to, and
  // somebody banking in Luxembourg who signed up as "Other" still needs to
  // find it there.
  Estonia: "EE",
  Iceland: "IS",
  Latvia: "LV",
  Liechtenstein: "LI",
  Lithuania: "LT",
  Luxembourg: "LU",
  Slovakia: "SK",
  Slovenia: "SI",
};

/**
 * Countries a handicapper can be paid out to through Stripe.
 *
 * This is narrower than "countries Stripe supports", and the reason is the
 * platform's own location. Blitz.tips is a Cyprus account, so moving money to
 * a connected account anywhere else is a cross-border payout, and Stripe only
 * does those self-serve between the US, the UK, the EEA, Canada and
 * Switzerland. An Express account outside that set either can't be created or
 * can't receive a destination charge once it is, so offering it would be
 * offering something that doesn't work.
 *
 * Nobody outside this list is turned away — crypto payouts have no such
 * restriction, which is what the payouts page sends them to.
 *
 * If the platform ever moves, or Stripe widens self-serve cross-border
 * payouts, this list is the only thing that has to change. Entries must also
 * be enabled under Connect settings → cross-border payouts in the Stripe
 * dashboard; a country enabled here but not there fails at account creation
 * with Stripe's own message, which the Connect route surfaces as-is.
 */
export const STRIPE_PAYOUT_COUNTRY_CODES: ReadonlySet<string> = new Set([
  // EEA
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IS",
  "IE",
  "IT",
  "LV",
  "LI",
  "LT",
  "LU",
  "MT",
  "NL",
  "NO",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  // Plus the rest of the self-serve cross-border set
  "GB",
  "US",
  "CA",
  "CH",
]);

/** The payout countries the picker offers, as `{ code, name }`, name-ordered. */
export const STRIPE_PAYOUT_COUNTRIES: { code: string; name: string }[] = Object.entries(
  COUNTRY_CODES
)
  .filter(([, code]) => STRIPE_PAYOUT_COUNTRY_CODES.has(code))
  .map(([name, code]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

/** A country name as its code, or null when the name isn't one we know. */
export function countryCode(name: string | null | undefined): string | null {
  if (!name) return null;
  return COUNTRY_CODES[name] ?? null;
}

/** The display name for a code, falling back to the code itself. */
export function countryName(code: string): string {
  return STRIPE_PAYOUT_COUNTRIES.find((c) => c.code === code)?.name
    ?? Object.entries(COUNTRY_CODES).find(([, c]) => c === code)?.[0]
    ?? code;
}

/** Whether Stripe payouts can reach this country from our platform. */
export function canStripePayout(code: string | null | undefined): boolean {
  return Boolean(code && STRIPE_PAYOUT_COUNTRY_CODES.has(code));
}
