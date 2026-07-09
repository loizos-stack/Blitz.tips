import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";
import { setSetting } from "@/lib/settings";
import {
  DASHBOARD_ORDER_SETTING,
  sectionsFor,
  type DashboardKind,
} from "@/lib/dashboard-sections";

function isKind(value: unknown): value is DashboardKind {
  return value === "handicapper" || value === "subscriber" || value === "profile";
}

export async function POST(request: Request) {
  const ctx = await requirePermission("cms");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const kind = body.kind;
  if (!isKind(kind)) {
    return NextResponse.json({ error: "Unknown dashboard" }, { status: 400 });
  }

  const validKeys = new Set(sectionsFor(kind).map((s) => s.key));
  const order = Array.isArray(body.order) ? body.order : null;
  if (!order || !order.every((k: unknown) => typeof k === "string" && validKeys.has(k))) {
    return NextResponse.json({ error: "Invalid order" }, { status: 400 });
  }
  // Reject duplicates and require every known section to be present, so a saved
  // order is always a complete, unambiguous arrangement.
  const unique = new Set(order);
  if (unique.size !== order.length || unique.size !== validKeys.size) {
    return NextResponse.json({ error: "Invalid order" }, { status: 400 });
  }

  const settingKey = DASHBOARD_ORDER_SETTING[kind];
  await setSetting(settingKey, JSON.stringify(order));
  await logAdmin(ctx.session, "cms.reorder", "SiteSetting", settingKey, order.join(","));
  return NextResponse.json({ ok: true });
}
