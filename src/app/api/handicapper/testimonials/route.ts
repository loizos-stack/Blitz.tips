import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/audit";

const MAX_TESTIMONIALS = 20;

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const profile = await prisma.handicapperProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Handicapper profile required" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const author = typeof body.author === "string" ? body.author.trim() : "";
  const quote = typeof body.quote === "string" ? body.quote.trim() : "";

  if (!author || author.length > 80) {
    return NextResponse.json({ error: "Add a name (up to 80 characters)" }, { status: 400 });
  }
  if (!quote || quote.length > 600) {
    return NextResponse.json({ error: "Add a quote (up to 600 characters)" }, { status: 400 });
  }

  const count = await prisma.testimonial.count({ where: { handicapperId: profile.id } });
  if (count >= MAX_TESTIMONIALS) {
    return NextResponse.json({ error: `You can add up to ${MAX_TESTIMONIALS} testimonials` }, { status: 400 });
  }

  const testimonial = await prisma.testimonial.create({
    data: { handicapperId: profile.id, author, quote },
  });
  await logActivity({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "testimonial.create",
    targetType: "Testimonial",
    targetId: testimonial.id,
    detail: `@${profile.handle} added testimonial from ${author}`,
  });
  return NextResponse.json({ testimonial });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const profile = await prisma.handicapperProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) return NextResponse.json({ error: "Handicapper profile required" }, { status: 403 });

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // deleteMany scoped to this owner's profile, so nobody can delete another's.
  const result = await prisma.testimonial.deleteMany({ where: { id, handicapperId: profile.id } });
  if (result.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await logActivity({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "testimonial.delete",
    targetType: "Testimonial",
    targetId: id,
    detail: `@${profile.handle} removed a testimonial`,
  });
  return NextResponse.json({ ok: true });
}
