/**
 * The canonical base URL for building absolute links (verification emails,
 * Stripe redirect/return URLs, etc.).
 *
 * Resolution order:
 *  1. NEXT_PUBLIC_APP_URL, but only if it's a real custom domain or localhost —
 *     a stale `*.vercel.app` value is ignored so production never leaks the
 *     preview domain into emails/redirects.
 *  2. On Vercel production, the project's production domain (e.g. blitz.tips).
 *  3. Otherwise the current deployment URL (preview) or localhost (dev).
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  if (explicit && !/\.vercel\.app$/i.test(explicit)) return explicit;

  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  return explicit ?? "http://localhost:3000";
}
