import "server-only";
import sanitizeHtml from "sanitize-html";
import { prisma } from "@/lib/prisma";

// Sanitize admin-authored post HTML before it's ever stored or rendered via
// dangerouslySetInnerHTML. Even though only admins can post, this is
// defense-in-depth against stored XSS if an admin account were ever compromised:
// it strips <script>, event handlers, and javascript: URLs while keeping the
// formatting tags a blog article needs.
export function sanitizePostHtml(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: [
      "h1", "h2", "h3", "h4", "h5", "h6",
      "p", "blockquote", "pre", "code", "hr", "br",
      "ul", "ol", "li",
      "strong", "em", "b", "i", "u", "s", "del", "mark", "sub", "sup",
      "a", "img", "figure", "figcaption",
      "table", "thead", "tbody", "tr", "th", "td",
      "span", "div",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      "*": ["class"],
    },
    // Only allow safe URL schemes; blocks javascript:/data: script vectors.
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    // Force external links to be safe.
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow" }, true),
    },
  });
}

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
