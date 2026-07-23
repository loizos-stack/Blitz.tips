import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";
import { slugify, sanitizePostHtml } from "@/lib/blog";

// Ensure the slug is unique, appending -2, -3, … on collision (ignoring the
// post being edited).
async function uniqueSlug(base: string, ignoreId?: string): Promise<string> {
  const root = base || "post";
  let slug = root;
  let n = 2;
  // A handful of iterations is plenty; slugs collide rarely.
  while (true) {
    const existing = await prisma.blogPost.findUnique({ where: { slug }, select: { id: true } });
    if (!existing || existing.id === ignoreId) return slug;
    slug = `${root}-${n++}`;
  }
}

// Create or update a blog post. Body: { id?, title, slug?, excerpt, contentHtml,
// coverImageUrl?, status }.
export async function POST(request: Request) {
  const ctx = await requirePermission("blog");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const excerpt = typeof body.excerpt === "string" ? body.excerpt.trim() : "";
  const rawContentHtml = typeof body.contentHtml === "string" ? body.contentHtml.trim() : "";
  const contentHtml = rawContentHtml ? sanitizePostHtml(rawContentHtml) : "";
  const coverImageUrl =
    typeof body.coverImageUrl === "string" && body.coverImageUrl.trim() ? body.coverImageUrl.trim() : null;
  const status = body.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
  const id = typeof body.id === "string" && body.id ? body.id : null;

  if (!title) return NextResponse.json({ error: "A title is required" }, { status: 400 });
  if (!excerpt) return NextResponse.json({ error: "A short excerpt is required" }, { status: 400 });
  if (!contentHtml) return NextResponse.json({ error: "The post body is empty" }, { status: 400 });

  const requestedSlug = typeof body.slug === "string" && body.slug.trim() ? slugify(body.slug) : slugify(title);
  const slug = await uniqueSlug(requestedSlug, id ?? undefined);

  if (id) {
    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    // Set publishedAt the first time a post goes live; keep it stable after.
    const publishedAt =
      status === "PUBLISHED" ? existing.publishedAt ?? new Date() : existing.publishedAt;

    const post = await prisma.blogPost.update({
      where: { id },
      data: { title, slug, excerpt, contentHtml, coverImageUrl, status, publishedAt },
    });
    await logAdmin(ctx.session, "blog.update", "BlogPost", id, `${status}: ${title}`);
    return NextResponse.json({ ok: true, post });
  }

  const post = await prisma.blogPost.create({
    data: {
      title,
      slug,
      excerpt,
      contentHtml,
      coverImageUrl,
      status,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
      authorId: ctx.userId,
    },
  });
  await logAdmin(ctx.session, "blog.create", "BlogPost", post.id, `${status}: ${title}`);
  return NextResponse.json({ ok: true, post });
}

export async function DELETE(request: Request) {
  const ctx = await requirePermission("blog");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "Missing post" }, { status: 400 });

  const result = await prisma.blogPost.deleteMany({ where: { id } });
  if (result.count === 0) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  await logAdmin(ctx.session, "blog.delete", "BlogPost", id);
  return NextResponse.json({ ok: true });
}
