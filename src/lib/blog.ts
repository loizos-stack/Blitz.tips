import "server-only";
import { prisma } from "@/lib/prisma";

// Turn a title into a URL-safe slug: lowercase, alphanumerics + single hyphens.
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// A post is publicly visible only when PUBLISHED with a publishedAt in the past.
export function publishedWhere() {
  return { status: "PUBLISHED" as const, publishedAt: { not: null, lte: new Date() } };
}

export async function listPublishedPosts() {
  return prisma.blogPost.findMany({
    where: publishedWhere(),
    orderBy: { publishedAt: "desc" },
    select: {
      slug: true,
      title: true,
      excerpt: true,
      coverImageUrl: true,
      publishedAt: true,
    },
  });
}

export async function getPublishedPost(slug: string) {
  return prisma.blogPost.findFirst({
    where: { slug, ...publishedWhere() },
    include: { author: { select: { name: true, username: true } } },
  });
}
