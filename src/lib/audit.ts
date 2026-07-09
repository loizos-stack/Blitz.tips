import "server-only";
import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";

/**
 * Record a change to the site in the activity log (the admin "Logs" tab).
 * Best-effort — a logging failure must never fail the action itself. Works for
 * any actor: admins, handicappers, subscribers, or the system (webhooks/cron).
 */
export async function logActivity(entry: {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  detail?: string;
}): Promise<void> {
  await prisma.adminAuditLog
    .create({
      data: {
        actorId: entry.actorId ?? "system",
        actorEmail: entry.actorEmail ?? "system",
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        detail: entry.detail,
      },
    })
    .catch((e) => console.error("activity log write failed:", e));
}

/** Convenience wrapper for admin-initiated actions. */
export async function logAdmin(
  session: Session,
  action: string,
  targetType: string,
  targetId: string,
  detail?: string
): Promise<void> {
  await logActivity({
    actorId: session.user.id,
    actorEmail: session.user.email ?? "unknown",
    action,
    targetType,
    targetId,
    detail,
  });
}
