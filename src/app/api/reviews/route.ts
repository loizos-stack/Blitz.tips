import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canReview } from "@/lib/reviews";
import { logActivity } from "@/lib/audit";

const MAX_BODY = 1000;

// Create or update the signed-in user's review of a handicapper. Only paid
// subscribers (current or past) may review — one review each, editable.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const handicapperId = typeof body.handicapperId === "string" ? body.handicapperId : "";
  const rating = Number(body.rating);
  const text = typeof body.body === "string" ? body.body.trim() : "";

  if (!handicapperId) return NextResponse.json({ error: "Missing handicapper" }, { status: 400 });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Pick a rating from 1 to 5 stars" }, { status: 400 });
  }
  if (text.length > MAX_BODY) {
    return NextResponse.json({ error: `Keep your review under ${MAX_BODY} characters` }, { status: 400 });
  }

  if (!(await canReview(session.user.id, handicapperId))) {
    return NextResponse.json(
      { error: "Only subscribers of one of this handicapper's paid packages can leave a review." },
      { status: 403 }
    );
  }

  // A new or edited review is held for moderation — it only goes public once an
  // admin approves it, so foul/hate language can be caught first.
  const review = await prisma.review.upsert({
    where: { handicapperId_authorId: { handicapperId, authorId: session.user.id } },
    create: { handicapperId, authorId: session.user.id, rating, body: text || null, status: "PENDING" },
    update: { rating, body: text || null, status: "PENDING", moderatedAt: null, moderatedBy: null },
  });

  await logActivity({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "review.upsert",
    targetType: "Review",
    targetId: review.id,
    detail: `${rating}★ review of handicapper ${handicapperId} (pending moderation)`,
  });

  return NextResponse.json({ review });
}

// Delete the signed-in user's own review of a handicapper.
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const handicapperId = new URL(request.url).searchParams.get("handicapperId") ?? "";
  if (!handicapperId) return NextResponse.json({ error: "Missing handicapper" }, { status: 400 });

  const result = await prisma.review.deleteMany({
    where: { handicapperId, authorId: session.user.id },
  });
  if (result.count === 0) return NextResponse.json({ error: "No review to remove" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
