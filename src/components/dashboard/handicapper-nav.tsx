"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  LineChart,
  BarChart3,
  Image as ImageIcon,
  Tag,
  Wallet,
  Award,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard/handicapper", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/handicapper/picks", label: "Post a tip", icon: PlusCircle },
  { href: "/dashboard/handicapper/performance", label: "Performance", icon: LineChart },
  { href: "/dashboard/handicapper/breakdowns", label: "Breakdowns", icon: BarChart3 },
  { href: "/dashboard/handicapper/profile", label: "Profile", icon: ImageIcon },
  { href: "/dashboard/handicapper/pricing", label: "Pricing", icon: Tag },
  { href: "/dashboard/handicapper/payouts", label: "Payouts", icon: Wallet },
  { href: "/dashboard/handicapper/plan", label: "Plan", icon: Award },
  { href: "/dashboard/handicapper/community", label: "Community", icon: MessageSquare },
];

export function HandicapperDashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2">
      {NAV.map(({ href, label, icon: Icon }) => {
        // Overview is the base path (a prefix of every other tab), so match it
        // exactly; the rest match on prefix to stay active on nested routes.
        const active = href === "/dashboard/handicapper" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-muted hover:border-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
