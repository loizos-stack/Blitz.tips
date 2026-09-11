/**
 * How many graded picks a handicapper profile needs before it asks to be
 * indexed, and before it appears in the sitemap.
 *
 * A profile with almost no settled picks has nothing for a search result to be
 * about, and a marketplace full of near-empty profiles reads to Google as thin
 * content — a footprint that is slow to dig out of once it's established. The
 * profiles stay live, linkable and crawlable either way; they just don't ask to
 * be indexed until there's a record to show.
 *
 * Low enough that a capper who has actually started posting is visible within
 * days. Raise it if the directory fills with abandoned profiles.
 *
 * The metadata and the sitemap must agree on this number: a sitemap advertising
 * URLs that carry a noindex tag contradicts itself, and Search Console reports
 * it as an error.
 */
export const MIN_INDEXABLE_PICKS = 3;
