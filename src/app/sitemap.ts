import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/site";

// Refresh hourly so newly published handicapper profiles get discovered without
// a redeploy.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/leaderboard`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/handicappers`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/refunds`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  // Every public handicapper profile. A DB hiccup at build time degrades to the
  // static routes rather than failing the whole sitemap.
  let handicapperEntries: MetadataRoute.Sitemap = [];
  try {
    const handicappers = await prisma.handicapperProfile.findMany({
      where: { suspendedAt: null },
      select: { handle: true, updatedAt: true },
    });
    handicapperEntries = handicappers.map((h) => ({
      url: `${base}/handicappers/${h.handle}`,
      lastModified: h.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.7,
    }));
  } catch {
    handicapperEntries = [];
  }

  return [...staticEntries, ...handicapperEntries];
}
