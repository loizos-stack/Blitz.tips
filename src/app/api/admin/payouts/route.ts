import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";

/**
 * Record money sent on to a handicapper.
 *
 * Before this existed, the financials tab added up everything ever earned
 * through crypto and told the admin to "keep your own record of settled
 * amounts" — so the column headed "net owed" was really "net earned, ever",
 * and it grew whether or not anybody had been paid. Each row written here is
 * one transfer that actually happened, and the owed figure is computed net of
 * them, so it can mean what it says.
 */
export async function POST(request: Request) {
  const ctx = await requirePermission("financials");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const handicapperId = typeof body?.handicapperId === "string" ? body.handicapperId : "";
  const amount = Number(body?.amount);
  const method = typeof body?.method === "string" ? body.method.trim() : "";
  const reference = typeof body?.reference === "string" ? body.reference.trim() : "";
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : "";
  const paidAt = typeof body?.paidAt === "string" && body.paidAt ? new Date(body.paidAt) : new Date();

  if (!handicapperId) return NextResponse.json({ error: "Pick a handicapper." }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Enter an amount greater than zero." }, { status: 400 });
  }
  if (!method) return NextResponse.json({ error: "Say how it was sent." }, { status: 400 });
  if (Number.isNaN(paidAt.getTime())) {
    return NextResponse.json({ error: "That isn't a date." }, { status: 400 });
  }

  const handicapper = await prisma.handicapperProfile.findUnique({
    where: { id: handicapperId },
    select: { handle: true, priceCurrency: true },
  });
  if (!handicapper) return NextResponse.json({ error: "Handicapper not found" }, { status: 404 });

  const amountCents = Math.round(amount * 100);
  const payout = await prisma.handicapperPayout.create({
    data: {
      handicapperId,
      amountCents,
      currency: handicapper.priceCurrency,
      method,
      reference: reference || null,
      note: note || null,
      paidAt,
      recordedById: ctx.session.user.id,
      recordedByEmail: ctx.session.user.email ?? null,
    },
  });

  await logAdmin(
    ctx.session,
    "payout.record",
    "HandicapperPayout",
    payout.id,
    `@${handicapper.handle}; ${(amountCents / 100).toFixed(2)} ${handicapper.priceCurrency} via ${method}${reference ? ` (${reference})` : ""}`
  );

  return NextResponse.json({ ok: true, id: payout.id });
}

/** Undo a payout written by mistake. */
export async function DELETE(request: Request) {
  const ctx = await requirePermission("financials");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Which payout?" }, { status: 400 });

  const payout = await prisma.handicapperPayout.delete({ where: { id } }).catch(() => null);
  if (!payout) return NextResponse.json({ error: "Payout not found" }, { status: 404 });

  await logAdmin(
    ctx.session,
    "payout.delete",
    "HandicapperPayout",
    id,
    `${(payout.amountCents / 100).toFixed(2)} ${payout.currency} via ${payout.method}`
  );
  return NextResponse.json({ ok: true });
}
