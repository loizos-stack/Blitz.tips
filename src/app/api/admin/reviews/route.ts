import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";

// Approve or reject a subscriber review. A review only appears on the public
// profile once APPROVED; REJECTED (and PENDING) reviews stay hidden.
export async function POST(request: Request) {
  const ctx = await requirePermission("reviews");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  const action = body.action;
  if (!id) return NextResponse.json({ error: "Missing review" }, { status: 400 });
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 });

  const status = action === "approve" ? "APPROVED" : "REJECTED";
  await prisma.review.update({
    where: { id },
    data: { status, moderatedAt: new Date(), moderatedBy: ctx.userId },
  });

  await logAdmin(ctx.session, `review.${action}`, "Review", id, `${review.rating}★ review ${status.toLowerCase()}`);
  return NextResponse.json({ ok: true, status });
}

// Delete a review outright (e.g. spam). Removes it for everyone.
export async function DELETE(request: Request) {
  const ctx = await requirePermission("reviews");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "Missing review" }, { status: 400 });

  const result = await prisma.review.deleteMany({ where: { id } });
  if (result.count === 0) return NextResponse.json({ error: "Review not found" }, { status: 404 });

  await logAdmin(ctx.session, "review.delete", "Review", id);
  return NextResponse.json({ ok: true });
}
