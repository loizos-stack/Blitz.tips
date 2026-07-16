import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";

/**
 * Admin authorization has two tiers:
 *
 *  - **Superadmins** have every permission and can manage other admins. They're
 *    bootstrapped from the ADMIN_EMAILS / SUPERADMIN_EMAILS env vars (so the
 *    first owner never needs a DB edit) and can also be flagged in-app via
 *    User.isSuperAdmin.
 *  - **Scoped admins** are role=ADMIN users whose access is limited to the set
 *    of permission keys in User.adminPermissions, granted from the Permissions
 *    tab by a superadmin.
 *
 * Guards below read the acting user straight from the database so promotions,
 * revocations, and permission edits take effect on the very next request — no
 * re-login required.
 */

export type AdminPermission =
  | "overview"
  | "users"
  | "handicappers"
  | "picks"
  | "subscriptions"
  | "financials"
  | "emails"
  | "promos"
  | "media"
  | "system"
  | "tickets"
  | "audit"
  | "permissions";

interface PermissionDef {
  key: AdminPermission;
  label: string;
  href: string;
  description: string;
  /** Only superadmins can ever hold this permission (it manages other admins). */
  superOnly?: boolean;
}

// The canonical catalog — drives the admin nav, the per-tab guards, and the
// checkboxes on the Permissions tab. Order here is the order tabs appear.
export const ADMIN_PERMISSIONS: PermissionDef[] = [
  { key: "overview", label: "Overview", href: "/admin", description: "Dashboard stats and recent signups" },
  { key: "users", label: "Users", href: "/admin/users", description: "View, verify, suspend, promote or delete users" },
  { key: "handicappers", label: "Handicappers", href: "/admin/handicappers", description: "Manage handicapper profiles and suspensions" },
  { key: "picks", label: "Picks", href: "/admin/picks", description: "Review picks and settlement integrity" },
  { key: "subscriptions", label: "Subscriptions", href: "/admin/subscriptions", description: "Cancel or refund subscriptions" },
  { key: "financials", label: "Financials", href: "/admin/financials", description: "Revenue, MRR and payout figures" },
  { key: "emails", label: "Emails", href: "/admin/emails", description: "Send mass email to users and handicappers" },
  { key: "promos", label: "Promos", href: "/admin/promos", description: "Create and manage promo codes" },
  { key: "media", label: "Media", href: "/admin/media", description: "Moderate profile and cover images" },
  { key: "system", label: "System", href: "/admin/system", description: "Announcements, odds quota, auto-settlement" },
  { key: "tickets", label: "Tickets", href: "/admin/tickets", description: "View and reply to support tickets from the contact form" },
  { key: "audit", label: "Logs", href: "/admin/logs", description: "Search and filter the site-wide activity log" },
  { key: "permissions", label: "Permissions", href: "/admin/permissions", description: "Create admins and grant them permissions", superOnly: true },
];

export const ALL_PERMISSION_KEYS = ADMIN_PERMISSIONS.map((p) => p.key);

/** Permissions a scoped admin is allowed to be granted (everything except superadmin-only). */
export const GRANTABLE_PERMISSIONS = ADMIN_PERMISSIONS.filter((p) => !p.superOnly);

const GRANTABLE_KEY_SET = new Set<string>(GRANTABLE_PERMISSIONS.map((p) => p.key));

function emailList(envVar: string): string[] {
  return (process.env[envVar] ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Bootstrap superadmins: anyone in ADMIN_EMAILS or SUPERADMIN_EMAILS. */
export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = [...emailList("ADMIN_EMAILS"), ...emailList("SUPERADMIN_EMAILS")];
  return list.includes(email.toLowerCase());
}

export interface AdminContext {
  session: Session;
  userId: string;
  email: string;
  isSuperAdmin: boolean;
  /** Effective permissions — every key for a superadmin, the granted subset otherwise. */
  permissions: Set<AdminPermission>;
}

/**
 * Resolve the acting admin from the database. Returns null for anyone who is
 * neither an admin nor a superadmin. DB-backed so it reflects live role and
 * permission changes rather than a stale JWT.
 */
export async function getAdminContext(): Promise<AdminContext | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, role: true, isSuperAdmin: true, adminPermissions: true, suspendedAt: true },
  });
  if (!user || user.suspendedAt) return null;

  const superAdmin = user.isSuperAdmin || isSuperAdminEmail(user.email);
  // Only actual admins (or superadmins) get through.
  if (!superAdmin && user.role !== "ADMIN") return null;

  const permissions = superAdmin
    ? new Set<AdminPermission>(ALL_PERMISSION_KEYS)
    : // Scoped admins only ever hold grantable keys — superadmin-only keys like
      // "permissions" can never leak in through stale/tampered data.
      new Set<AdminPermission>(
        user.adminPermissions.filter((p): p is AdminPermission => GRANTABLE_KEY_SET.has(p))
      );

  return { session, userId: session.user.id, email: user.email, isSuperAdmin: superAdmin, permissions };
}

/** Guard for a page or API route tied to a single permission key. */
export async function requirePermission(key: AdminPermission): Promise<AdminContext | null> {
  const ctx = await getAdminContext();
  if (!ctx) return null;
  if (ctx.isSuperAdmin || ctx.permissions.has(key)) return ctx;
  return null;
}

/** Guard that passes if the admin holds any one of the given permissions. */
export async function requireAnyPermission(keys: AdminPermission[]): Promise<AdminContext | null> {
  const ctx = await getAdminContext();
  if (!ctx) return null;
  if (ctx.isSuperAdmin || keys.some((k) => ctx.permissions.has(k))) return ctx;
  return null;
}

/** Guard for superadmin-only surfaces (managing other admins). */
export async function requireSuperAdmin(): Promise<AdminContext | null> {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isSuperAdmin) return null;
  return ctx;
}

/**
 * Page-level guard: returns the admin context or redirects. Non-admins go home;
 * admins lacking this tab's permission are sent to the first tab they *can*
 * open (or home if they have none), so there's never a redirect loop.
 */
export async function guardAdminPage(key: AdminPermission): Promise<AdminContext> {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/");
  if (!ctx.isSuperAdmin && !ctx.permissions.has(key)) {
    const first = ADMIN_PERMISSIONS.find((p) => ctx.permissions.has(p.key));
    redirect(first ? first.href : "/");
  }
  return ctx;
}
