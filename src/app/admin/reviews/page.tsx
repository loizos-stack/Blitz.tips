import { prisma } from "@/lib/prisma";
import { guardAdminPage } from "@/lib/permissions";
import { ReviewsModerator } from "@/components/admin/reviews-moderator";

export const dynamic = "force-dynamic";

export default async function AdminReviewsPage() {
  await guardAdminPage("reviews");

  // Pending first (the queue that needs attention), then most recent.
  const reviews = await prisma.review.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 300,
    include: {
      handicapper: { select: { handle: true, displayName: true } },
      author: { select: { name: true, username: true, email: true } },
    },
  });

  const data = reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    body: r.body,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    handicapperHandle: r.handicapper.handle,
    handicapperName: r.handicapper.displayName,
    authorName: r.author.name || r.author.username || "Subscriber",
    authorEmail: r.author.email,
  }));

  return <ReviewsModerator initialReviews={data} />;
}
