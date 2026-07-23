import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";

const STATUSES = ["DRAFT", "OPEN", "CLOSED", "SETTLED"] as const;
type Status = (typeof STATUSES)[number];

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

// Create or update a contest. Prize pool is derived from the split so the
// "guaranteed" headline always matches what's actually awarded.
export async function POST(request: Request) {
  const ctx = await requirePermission("contests");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const slug = (typeof body.slug === "string" && body.slug.trim() ? slugify(body.slug) : slugify(name)) || "contest";
  const tagline = typeof body.tagline === "string" ? body.tagline.trim() || null : null;
  const minPicks = Math.max(1, Math.round(Number(body.minPicks) || 20));
  const status: Status = STATUSES.includes(body.status) ? body.status : "DRAFT";

  const startsAt = new Date(body.startsAt);
  const endsAt = new Date(body.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return NextResponse.json({ error: "Valid start and end dates are required" }, { status: 400 });
  }
  if (endsAt <= startsAt) {
    return NextResponse.json({ error: "End date must be after the start date" }, { status: 400 });
  }

  // Prize split: array of whole-dollar amounts per place, converted to cents.
  const rawSplit = Array.isArray(body.prizeSplitDollars) ? body.prizeSplitDollars : [];
  const prizeSplitCents = rawSplit
    .map((v: unknown) => Math.max(0, Math.round(Number(v) * 100)))
    .filter((c: number) => Number.isFinite(c));
  if (prizeSplitCents.length === 0) {
    return NextResponse.json({ error: "Add at least one prize place" }, { status: 400 });
  }
  const prizePoolCents = prizeSplitCents.reduce((sum: number, c: number) => sum + c, 0);

  const data = { slug, name, tagline, minPicks, status, startsAt, endsAt, prizeSplitCents, prizePoolCents };

  let contest;
  if (typeof body.id === "string" && body.id) {
    contest = await prisma.contest.update({ where: { id: body.id }, data });
    await logAdmin(ctx.session, "contest.update", "Contest", contest.id, `${name} → ${status}`);
  } else {
    const existing = await prisma.contest.findUnique({ where: { slug } });
    if (existing) return NextResponse.json({ error: "A contest with that slug already exists" }, { status: 409 });
    contest = await prisma.contest.create({ data });
    await logAdmin(ctx.session, "contest.create", "Contest", contest.id, name);
  }

  return NextResponse.json({ contest });
}
