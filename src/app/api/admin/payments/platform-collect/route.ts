import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";
import { platformCollectEnabled, setPlatformCollectEnabled } from "@/lib/platform-collect";

/**
 * The switch for collecting card payments on a handicapper's behalf.
 *
 * Its own route rather than a field on the direct-payment settings, because
 * that one refuses to turn on without payment instructions to show a customer
 * — a rule that makes sense there and none at all here, where Stripe already
 * knows where the money goes.
 *
 * Turning it OFF does not touch subscriptions that already exist: those keep
 * billing, keep landing in the platform balance, and keep being owed. It only
 * stops new ones starting that way, so a handicapper who has not connected
 * goes back to having no card button.
 */
export async function POST(request: Request) {
  const ctx = await requirePermission("financials");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be true or false" }, { status: 400 });
  }

  await setPlatformCollectEnabled(body.enabled);
  await logAdmin(
    ctx.session,
    "payments.platformCollect.settings",
    "SiteSetting",
    "payments.platformCollect",
    body.enabled
      ? "enabled — card sales for handicappers without Stripe Connect are collected by the platform"
      : "disabled — only connected handicappers can take card payments"
  );

  return NextResponse.json({ ok: true, enabled: await platformCollectEnabled() });
}
