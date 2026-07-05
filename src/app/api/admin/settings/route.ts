import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { logAdmin } from "@/lib/audit";
import { setSetting } from "@/lib/settings";

// Settings the panel may write; anything else is rejected.
const EDITABLE_KEYS = ["announcement"];

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const key = typeof body.key === "string" ? body.key : "";
  const value = typeof body.value === "string" ? body.value : "";

  if (!EDITABLE_KEYS.includes(key)) {
    return NextResponse.json({ error: "Unknown setting" }, { status: 400 });
  }

  await setSetting(key, value);
  await logAdmin(session, "setting.update", "SiteSetting", key, value.slice(0, 200));
  return NextResponse.json({ ok: true });
}
