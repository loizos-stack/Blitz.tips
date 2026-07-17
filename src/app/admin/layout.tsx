import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminContext, ADMIN_PERMISSIONS } from "@/lib/permissions";
import { getAdminBadgeCounts } from "@/lib/admin-badges";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/");

  // Only show tabs this admin can actually open.
  const nav = ADMIN_PERMISSIONS.filter((p) => ctx.isSuperAdmin || ctx.permissions.has(p.key));
  // Number bubbles flag tabs with items needing attention or new since last look.
  const badges = await getAdminBadgeCounts(ctx.userId);

  return (
    <div className="container-page py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            Admin
            {ctx.isSuperAdmin && (
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                Superadmin
              </span>
            )}
          </h1>
          <p className="text-sm text-muted">Signed in as {ctx.email}</p>
        </div>
        <nav className="flex flex-wrap gap-2">
          {nav.map((item) => {
            const count = badges[item.key] ?? 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-muted hover:border-muted hover:text-foreground"
              >
                {item.label}
                {count > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-xs font-semibold text-white">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
