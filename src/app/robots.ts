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
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
