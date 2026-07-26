import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { getPublishedPost } from "@/lib/blog";
import { ArticleJsonLd } from "@/components/json-ld";
import { ShareButtons } from "@/components/share-buttons";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) return { title: "Post not found" };

  const path = `/blog/${post.slug}`;
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      url: path,
      publishedTime: post.publishedAt?.toISOString(),
      ...(post.coverImageUrl ? { images: [{ url: post.coverImageUrl }] } : {}),
    },
    twitter: {
      card: post.coverImageUrl ? "summary_large_image" : "summary",
      title: post.title,
      description: post.excerpt,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post || !post.publishedAt) notFound();

  const authorName = post.author.name || post.author.username || "Blitz.tips";

  return (
    <article className="container-page max-w-3xl py-12">
      <ArticleJsonLd
        title={post.title}
        description={post.excerpt}
        slug={post.slug}
        image={post.coverImageUrl}
        publishedAt={post.publishedAt.toISOString()}
        updatedAt={post.updatedAt.toISOString()}
        authorName={authorName}
      />

      <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All posts
      </Link>

      <h1 className="mt-4 text-3xl font-bold leading-tight md:text-4xl">{post.title}</h1>
      <p className="mt-3 text-sm text-muted">
        {format(post.publishedAt, "MMMM d, yyyy")} · {authorName}
      </p>

      {post.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary editor-supplied cover host
        <img src={post.coverImageUrl} alt="" className="mt-6 w-full rounded-xl border border-border object-cover" />
      )}

      <div
        className="prose-blog mt-8 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: post.contentHtml }}
      />

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
        <p className="text-sm text-muted">Share this post</p>
        <ShareButtons url={`${siteUrl()}/blog/${post.slug}`} text={post.title} />
      </div>
    </article>
  );
}
