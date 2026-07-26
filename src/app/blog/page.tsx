import Link from "next/link";
import type { Metadata } from "next";
import { format } from "date-fns";
import { listPublishedPosts } from "@/lib/blog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Insights on verified sports handicapping, transparency, betting strategy, and how Blitz.tips tracks every pick — from the Blitz.tips team.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "The Blitz.tips Blog",
    description: "Verified handicapping, transparency, and betting strategy from Blitz.tips.",
    url: "/blog",
  },
};

export default async function BlogIndexPage() {
  const posts = await listPublishedPosts();

  return (
    <div className="container-page py-12">
      <div className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-bold">The Blitz.tips Blog</h1>
        <p className="mt-2 text-muted">
          Transparency, strategy, and how we keep every handicapper honest.
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="card p-8 text-center text-muted">No posts yet — check back soon.</div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="card group flex flex-col overflow-hidden p-0 transition-colors hover:border-accent/60">
              {p.coverImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- arbitrary editor-supplied cover host
                <img src={p.coverImageUrl} alt="" loading="lazy" decoding="async" className="h-40 w-full object-cover" />
              )}
              <div className="flex flex-1 flex-col p-5">
                {p.publishedAt && (
                  <p className="text-xs text-muted">{format(new Date(p.publishedAt), "MMMM d, yyyy")}</p>
                )}
                <h2 className="mt-1 font-semibold group-hover:text-accent">{p.title}</h2>
                <p className="mt-2 line-clamp-3 text-sm text-muted">{p.excerpt}</p>
                <span className="mt-4 text-sm font-medium text-accent">Read more →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
