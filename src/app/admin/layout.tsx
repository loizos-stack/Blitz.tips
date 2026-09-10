import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BadgeCheck,
  Ticket,
  Repeat,
  Banknote,
  Mail,
  Tag,
  Megaphone,
  Activity,
  Image as ImageIcon,
  Settings,
  LifeBuoy,
  MessagesSquare,
  Star,
  FileText,
  Trophy,
  ShieldAlert,
  ScrollText,
  KeyRound,
} from "lucide-react";
import { getAdminContext, ADMIN_PERMISSIONS, type AdminPermission } from "@/lib/permissions";
import { getAdminBadgeCounts } from "@/lib/admin-badges";
import { SocialIcon } from "@/components/social-icon";

export const metadata: Metadata = { title: "Admin" };

/**
 * A glyph per tab, so the pills can be found by shape rather than read one by
 * one — there are twenty of them, and at a glance they are otherwise an
 * undifferentiated row of words.
 *
 * Kept here rather than in the permission catalog on purpose: that module is
 * `server-only` and imported by every guarded API route, and hanging icon
 * components off it would pull the icon set into all of them for the benefit of
 * one nav. Typed as a full Record so adding a permission without an icon is a
 * compile error rather than a silently blank pill.
 *
 * X and Telegram use the site's own brand glyphs, since this build of
 * lucide-react ships none and a generic stand-in reads as the wrong service.
 */
const ICONS: Record<AdminPermission, React.ReactNode> = {
  overview: <LayoutDashboard className="h-3.5 w-3.5" />,
  users: <Users className="h-3.5 w-3.5" />,
  handicappers: <BadgeCheck className="h-3.5 w-3.5" />,
  picks: <Ticket className="h-3.5 w-3.5" />,
  subscriptions: <Repeat className="h-3.5 w-3.5" />,
  financials: <Banknote className="h-3.5 w-3.5" />,
  emails: <Mail className="h-3.5 w-3.5" />,
  promos: <Tag className="h-3.5 w-3.5" />,
  ads: <Megaphone className="h-3.5 w-3.5" />,
  telegram: <SocialIcon platform="telegram" className="h-3.5 w-3.5" />,
  x: <SocialIcon platform="x" className="h-3.5 w-3.5" />,
  props: <Activity className="h-3.5 w-3.5" />,
  media: <ImageIcon className="h-3.5 w-3.5" />,
  system: <Settings className="h-3.5 w-3.5" />,
  tickets: <LifeBuoy className="h-3.5 w-3.5" />,
  chat: <MessagesSquare className="h-3.5 w-3.5" />,
  reviews: <Star className="h-3.5 w-3.5" />,
  blog: <FileText className="h-3.5 w-3.5" />,
  contests: <Trophy className="h-3.5 w-3.5" />,
  integrity: <ShieldAlert className="h-3.5 w-3.5" />,
  audit: <ScrollText className="h-3.5 w-3.5" />,
  permissions: <KeyRound className="h-3.5 w-3.5" />,
};

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
                {/* Decorative: the label beside it already names the tab, so the
                    glyph must not be announced twice to a screen reader. */}
                <span aria-hidden className="shrink-0">
                  {ICONS[item.key]}
                </span>
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
