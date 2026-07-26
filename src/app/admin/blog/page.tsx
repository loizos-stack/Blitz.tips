import { guardAdminPage } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { BlogManager, type AdminBlogPost } from "@/components/admin/blog-manager";

export const dynamic = "force-dynamic";

export default async function AdminBlogPage() {
  await guardAdminPage("blog");

  const rows = await prisma.blogPost.findMany({
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      contentHtml: true,
      coverImageUrl: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
    },
  });

  const posts: AdminBlogPost[] = rows.map((p) => ({
    ...p,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    updatedAt: p.updatedAt.toISOString(),
  }));

  return <BlogManager initialPosts={posts} />;
}
