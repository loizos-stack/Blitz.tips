import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { commissionPercentForPlan } from "@/lib/plans";
import { isEmailVerified } from "@/lib/verification";
import { packageCents, type PackageInterval } from "@/lib/subscriber-pricing";
import { directPaymentSettings, paymentReference } from "@/lib/direct-payments";
import { notifyAdmins } from "@/lib/admin-alerts";

/**
 * Ask to pay for a pass off-platform.
 *
 * This grants nothing. It records what was asked for, at today's price and
 * commission split, and hands back a reference to quote on the transfer. The
 * pass starts when an admin confirms the money arrived — which the response
 * says, because a checkout that looks like it worked and gives no access is
 * the fastest way to a support ticket.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const settings = await directPaymentSettings();
  if (!settings.enabled) {
    return NextResponse.json({ error: "Direct payment isn't available." }, { status: 400 });
  }

  if (!(await isEmailVerified(session.user.id))) {
    return NextResponse.json(
      { error: "Please verify your email before subscribing." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const handicapperId = body?.handicapperId;
  if (typeof handicapperId !== "string") {
    return NextResponse.json({ error: "Missing handicapperId" }, { status: 400 });
  }
  const interval: PackageInterval = ["WEEKLY", "MONTHLY", "ANNUAL"].includes(body?.interval)
    ? body.interval
    : "MONTHLY";
  // Only a method actually on offer — otherwise the instructions on screen
  // wouldn't match what the payer thinks they are doing.
  const method = settings.methods.includes(body?.method) ? body.method : settings.methods[0];
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : null;

  const handicapper = await prisma.handicapperProfile.findUnique({ where: { id: handicapperId } });
  if (!handicapper) return NextResponse.json({ error: "Handicapper not found" }, { status: 404 });
  if (handicapper.userId === session.user.id) {
    return NextResponse.json({ error: "You can't subscribe to yourself" }, { status: 400 });
  }
  if (handicapper.suspendedAt) {
    return NextResponse.json(
      { error: "This handicapper isn't accepting subscribers" },
      { status: 400 }
    );
  }

  const amountCents = packageCents(handicapper, interval as PackageInterval);
  if (amountCents == null) {
    return NextResponse.json(
      { error: "That package isn't offered by this handicapper" },
      { status: 400 }
    );
  }

  const existing = await prisma.subscription.findUnique({
    where: { subscriberId_handicapperId: { subscriberId: session.user.id, handicapperId } },
  });
  if (existing?.status === "ACTIVE" && existing.stripeSubscriptionId) {
    return NextResponse.json({ error: "You're already subscribed" }, { status: 409 });
  }

  // One open request at a time per handicapper. Two outstanding references
  // for the same pass is how a single transfer ends up matched to the wrong
  // row, or confirmed twice.
  const pending = await prisma.directPayment.findFirst({
    where: { subscriberId: session.user.id, handicapperId, status: "PENDING" },
  });
  if (pending) {
    return NextResponse.json({
      reference: pending.reference,
      amountCents: pending.amountCents,
      currency: pending.currency,
      method: pending.method,
      instructions: settings.instructions,
      alreadyPending: true,
    });
  }

  const commissionCents = Math.round(
    (amountCents * commissionPercentForPlan(handicapper.plan)) / 100
  );

  // The reference has to be unique and is random, so a clash is possible and
  // boring: try again rather than fail the purchase.
  let created = null;
  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    try {
      created = await prisma.directPayment.create({
        data: {
          reference: paymentReference(),
          subscriberId: session.user.id,
          handicapperId,
          interval,
          amountCents,
          currency: handicapper.priceCurrency,
          commissionCents,
          netCents: amountCents - commissionCents,
          method,
          note,
        },
      });
    } catch (error) {
      const clash =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!clash) throw error;
    }
  }
  if (!created) {
    return NextResponse.json({ error: "Couldn't start the payment. Try again." }, { status: 500 });
  }

  const buyer = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });
  await notifyAdmins({
    kind: "subscription.new",
    title: `Payment to confirm: ${created.reference}`,
    details: [
      ["Customer", buyer?.email ?? session.user.id],
      ["Handicapper", `@${handicapper.handle}`],
      ["Amount", `${(created.amountCents / 100).toFixed(2)} ${created.currency}`],
      ["Paying with", method],
      ["Reference", created.reference],
      ...(note ? ([["Their note", note]] as [string, string][]) : []),
    ],
    path: "/admin/financials",
  });

  return NextResponse.json({
    reference: created.reference,
    amountCents: created.amountCents,
    currency: created.currency,
    method,
    instructions: settings.instructions,
  });
}
