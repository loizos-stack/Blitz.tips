import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private / auth-gated / transactional areas stay out of the index.
      disallow: [
        "/admin",
        "/dashboard",
        "/settings",
        "/onboarding",
        "/welcome",
        "/api/",
        "/verify-email",
        "/unsubscribe",

        // Filter permutations of the public listings.
        //
        // /leaderboard alone offers 6 sorts x 5 periods x ~6 sports, which is
        // around 180 URLs that return the same roster in a different order.
        // Each one is a server render, so a single crawler walking the filter
        // links costs ~180 renders to index nothing new. That is how this site
        // exhausted a month of compute and had the account paused.
        //
        // The canonical tags on these pages already told indexers which URL to
        // KEEP; they never stopped the others being fetched, and fetching is
        // the part that costs. This does.
        //
        // The bare paths stay allowed and stay in the sitemap — only the
        // query-string variants go. A trailing "?" is matched literally, so
        // "/leaderboard" is unaffected while "/leaderboard?sort=roi" is not.
        "/leaderboard?",
        "/handicappers?",
        "/handicappers/*?",
        "/blog?",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
