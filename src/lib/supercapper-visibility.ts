/**
 * Whether Supercapper is shown on the public site.
 *
 * The contest is postponed until there is enough traffic to fill a field, so
 * every public trace of it is hidden: the pages themselves, the nav section,
 * the home-page strip, the pop-up and the sitemap entries.
 *
 * Nothing is deleted. The routes, components, contest records and the whole
 * admin section are untouched and keep working — this is one boolean in front
 * of the public surfaces, so bringing the contest back is a switch rather than
 * a rebuild.
 *
 * To bring it back: set SUPERCAPPER_VISIBLE=1 in the Vercel project's
 * environment variables and redeploy. Hidden is the default on purpose — with
 * the variable absent, missing or anything other than "1", the contest stays
 * out of sight, so a lost or mistyped setting can't put a postponed contest
 * back in front of customers.
 *
 * Deliberately not a SiteSetting row: those are read with an async database
 * call, and this is checked in a client component (the nav) and in a layout
 * that has to decide before rendering. An env var is readable in both without
 * turning every page that mentions the contest into a database query.
 *
 * NEXT_PUBLIC_ because the nav and the pop-up are client components and have
 * to make the same decision the server did; a mismatch would hydrate a nav
 * that flashes contest links and then removes them.
 */
export function supercapperVisible(): boolean {
  return process.env.NEXT_PUBLIC_SUPERCAPPER_VISIBLE === "1";
}
