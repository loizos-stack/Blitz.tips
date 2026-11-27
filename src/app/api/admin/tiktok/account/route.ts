import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";
import { disconnectAccount, getConnectedAccount } from "@/lib/tiktok";

export const dynamic = "force-dynamic";

/** Drop the stored grant. The app's authorisation also has to be revoked in TikTok itself. */
export async function DELETE() {
  const ctx = await requirePermission("recaps");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const existing = await getConnectedAccount();
  await disconnectAccount();
  await logAdmin(
    ctx.session,
    "tiktok.disconnect",
    "TikTokAccount",
    existing?.openId ?? "default",
    `Disconnected ${existing?.displayName ?? existing?.openId ?? "the TikTok account"}`
  );
  return NextResponse.json({ ok: true });
}
