import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";

export async function GET() {
  const ctx = await requirePermission("promos");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  try {
    const codes = await stripe.promotionCodes.list({ limit: 50, expand: ["data.promotion.coupon"] });
    return NextResponse.json({
      promos: codes.data.map((c) => {
        const coupon = typeof c.promotion.coupon === "object" ? c.promotion.coupon : null;
        return {
          id: c.id,
          code: c.code,
          active: c.active,
          percentOff: coupon?.percent_off ?? null,
          duration: coupon?.duration ?? null,
          timesRedeemed: c.times_redeemed,
        };
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe call failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const ctx = await requirePermission("promos");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  const session = ctx.session;

  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const percentOff = Number(body.percentOff);
  const duration = ["once", "repeating", "forever"].includes(body.duration) ? body.duration : "once";
  const durationInMonths = duration === "repeating" ? Math.max(1, Number(body.months) || 3) : undefined;

  if (!code || !/^[A-Z0-9_-]{3,32}$/.test(code)) {
    return NextResponse.json({ error: "Code must be 3–32 letters/numbers" }, { status: 400 });
  }
  if (!Number.isFinite(percentOff) || percentOff < 1 || percentOff > 100) {
    return NextResponse.json({ error: "Percent off must be 1–100" }, { status: 400 });
  }

  try {
    const coupon = await stripe.coupons.create({
      percent_off: percentOff,
      duration,
      ...(durationInMonths ? { duration_in_months: durationInMonths } : {}),
      name: `${code} (${percentOff}% off)`,
    });
    const promo = await stripe.promotionCodes.create({
      promotion: { type: "coupon", coupon: coupon.id },
      code,
    });
    await logAdmin(session, "promo.create", "PromotionCode", promo.id, `${code} ${percentOff}% ${duration}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe call failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const ctx = await requirePermission("promos");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  const session = ctx.session;

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Missing promo id" }, { status: 400 });

  try {
    await stripe.promotionCodes.update(id, { active: Boolean(body.active) });
    await logAdmin(session, "promo.toggle", "PromotionCode", id, `active=${Boolean(body.active)}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe call failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
