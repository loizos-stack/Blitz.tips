import "server-only";
import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";

/**
 * Record an admin mutation in the audit log. Best-effort — a logging failure
 * must never fail the action itself.
 */
export async function logAdmin(
  session: Session,
  action: string,
  targetType: string,
  targetId: string,
  detail?: string
): Promise<void> {
  await prisma.adminAuditLog
    .create({
      data: {
        actorId: session.user.id,
        actorEmail: session.user.email ?? "unknown",
        action,
        targetType,
        targetId,
        detail,
      },
    })
    .catch((e) => console.error("audit log write failed:", e));
}
