import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";
import { disconnectAccount, getConnectedAccount } from "@/lib/x-api";

export const dynamic = "force-dynamic";

/**
 * Disconnect the stored X grant.
 *
 * Local only — it deletes our copy of the tokens and does not revoke them at
 * X's end. That is worth knowing rather than assuming: to be certain the grant
 * is dead, revoke this app under X's connected-apps settings too. Deleting the
 * row is enough to stop *this* panel posting, which is what the button claims.
 */
export async function DELETE() {
  const ctx = await requirePermission("x");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const account = await getConnectedAccount();
  if (!account) return NextResponse.json({ ok: true, alreadyDisconnected: true });

  await disconnectAccount();
  await logAdmin(ctx.session, "x.disconnect", "XAccount", account.xUserId, `Disconnected @${account.username}`);
  return NextResponse.json({ ok: true });
}
