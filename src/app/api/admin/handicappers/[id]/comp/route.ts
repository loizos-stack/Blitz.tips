import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";
import { grantCompedPlan, endCompedPlan, isCompPlan } from "@/lib/comped-plans";
import { formatDate } from "@/lib/date-format";

/** Longest comp the UI offers; the cap is here so a crafted request can't beat it. */
const MAX_DAYS = 365;

/**
 * Give a handicapper a Silver or Gold plan for a period (POST), or end one
 * early (DELETE).
 *
 * The rules that decide whether a grant is allowed live in
 * src/lib/comped-plans.ts, not here — the sweep enforces the same ones, and
 * two copies of that reasoning would eventually disagree.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAnyPermission(["handicappers"]);
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  if (typeof body.plan !== "string" || !isCompPlan(body.plan)) {
    return NextResponse.json({ error: "Pick Silver or Gold." }, { status: 400 });
  }
  const days = Number(body.days);
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
    return NextResponse.json({ error: `Length must be 1 to ${MAX_DAYS} days.` }, { status: 400 });
  }

  const endsAt = new Date(Date.now() + days * 86_400_000);
  const result = await grantCompedPlan({
    handicapperId: id,
    plan: body.plan,
    endsAt,
    grantedById: ctx.userId,
  });

  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 409 });

  await logAdmin(
    ctx.session,
    "handicapper.comp",
    "HandicapperProfile",
    id,
    `${result.plan} for ${days}d, to ${formatDate(result.endsAt)}${result.warned ? "" : " (no reminder — under 3 days)"}`
  );
  return NextResponse.json({ ok: true, plan: result.plan, endsAt: result.endsAt, warned: result.warned });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAnyPermission(["handicappers"]);
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const { id } = await params;
  // notify: false — the expiry email says the plan "ran out", and an admin
  // ending one early is not that. Sending it would be a small lie to someone
  // who is about to notice their commission changed.
  const ended = await endCompedPlan({ handicapperId: id, notify: false });
  if (!ended) return NextResponse.json({ error: "No comped plan to end." }, { status: 404 });

  await logAdmin(ctx.session, "handicapper.comp.revoke", "HandicapperProfile", id, "back to Free");
  return NextResponse.json({ ok: true });
}
