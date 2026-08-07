import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";
import { MetaAdsError, metaAdsConfigured, setStatus } from "@/lib/meta-ads";

export const dynamic = "force-dynamic";

/**
 * Pause or resume a campaign, ad set or ad.
 *
 * This is the only path to ACTIVE, and it is deliberately not part of creation.
 * Setting something live starts spending real money against a real card, on a
 * platform where the money is gone the moment it's spent — so it gets its own
 * endpoint, its own confirmation in the UI, and its own audit line naming who
 * did it. Meta object ids are opaque across all three levels, so one route
 * covers them.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("ads");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  if (!metaAdsConfigured()) {
    return NextResponse.json({ error: "Meta Ads is not configured" }, { status: 503 });
  }

  const { id } = await params;
  // Meta ids are numeric strings. Reject anything else rather than forwarding
  // it — a path segment goes straight into the Graph URL.
  if (!/^\d{5,}$/.test(id)) {
    return NextResponse.json({ error: "Invalid object id" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const status = body.status === "ACTIVE" ? "ACTIVE" : body.status === "PAUSED" ? "PAUSED" : null;
  if (!status) {
    return NextResponse.json({ error: "status must be ACTIVE or PAUSED" }, { status: 400 });
  }

  try {
    await setStatus(id, status);
  } catch (e) {
    const err = e instanceof MetaAdsError ? e : null;
    return NextResponse.json(
      { error: err?.message ?? "Meta rejected the status change" },
      { status: err?.status && err.status < 500 ? 400 : 502 }
    );
  }

  await logAdmin(
    ctx.session,
    status === "ACTIVE" ? "ads.activate" : "ads.pause",
    "MetaObject",
    id,
    `set ${status}`
  );

  return NextResponse.json({ ok: true, id, status });
}
