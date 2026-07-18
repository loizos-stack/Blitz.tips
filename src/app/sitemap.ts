import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/site";
import { publishedWhere } from "@/lib/blog";

// Generated at request time (not prerendered at build) so it can never fail the
// build or ship a broken static copy; the DB read is best-effort and the route
// always returns at least the static routes.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/leaderboard`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/handicappers`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/refunds`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  try {
    const [handicappers, posts] = await Promise.all([
      prisma.handicapperProfile.findMany({
        where: { suspendedAt: null },
        select: { handle: true, updatedAt: true },
      }),
      prisma.blogPost.findMany({
        where: publishedWhere(),
        select: { slug: true, updatedAt: true },
      }),
    ]);
    return [
      ...staticEntries,
      ...handicappers.map((h) => ({
        url: `${base}/handicappers/${h.handle}`,
        lastModified: h.updatedAt,
        changeFrequency: "daily" as const,
        priority: 0.7,
      })),
      ...posts.map((p) => ({
        url: `${base}/blog/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
    ];
  } catch {
    // A DB hiccup degrades to the static routes rather than 404-ing the sitemap.
    return staticEntries;
  }
}
