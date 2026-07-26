import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.siteSetting.findUnique({ where: { key } }).catch(() => null);
  return row?.value ?? null;
}

// Cached announcement read for the site-wide banner. Server-rendered into the
// initial HTML (via this cached getter, so pages that were static stay static)
// instead of fetched client-side after load — which was shoving the whole page
// down and driving Cumulative Layout Shift.
export const getCachedAnnouncement = unstable_cache(
  async () => (await getSetting("announcement"))?.trim() || null,
  ["site-announcement-v1"],
  { revalidate: 60, tags: ["announcement"] }
);

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}
