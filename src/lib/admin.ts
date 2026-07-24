import "server-only";
import { auth } from "@/auth";
import type { Session } from "next-auth";

/**
 * Admins are designated by email via the ADMIN_EMAILS env var (comma-separated).
 * Any account signing in with a listed email gets the ADMIN role — no manual
 * database edit needed to bootstrap the first admin in production.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

/** Session guard for admin pages and /api/admin routes; null unless an admin. */
export async function requireAdmin(): Promise<Session | null> {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}
