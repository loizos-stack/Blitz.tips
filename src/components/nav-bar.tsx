"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Menu, X, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/handicappers", label: "Handicappers" },
  { href: "/pricing", label: "Become a Handicapper" },
];

export function NavBar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <TrendingUp className="h-5 w-5" />
          </span>
          Blitz<span className="text-accent">.tips</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-foreground",
                pathname?.startsWith(link.href) ? "text-foreground" : "text-muted"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {status === "authenticated" ? (
            <>
              <Link
                href={session.user.role === "HANDICAPPER" ? "/dashboard/handicapper" : "/dashboard"}
                className="text-sm font-medium text-muted hover:text-foreground"
              >
                Dashboard
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-muted"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/signin" className="text-sm font-medium text-muted hover:text-foreground">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
              >
                Get started
              </Link>
            </>
          )}
        </div>

        <button
          className="md:hidden text-foreground"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="container-page flex flex-col gap-1 py-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-2 py-2.5 text-sm font-medium text-muted hover:bg-surface hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
              {status === "authenticated" ? (
                <>
                  <Link
                    href={session.user.role === "HANDICAPPER" ? "/dashboard/handicapper" : "/dashboard"}
                    className="rounded-lg px-2 py-2.5 text-sm font-medium text-muted hover:bg-surface hover:text-foreground"
                    onClick={() => setOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="rounded-lg border border-border px-4 py-2.5 text-left text-sm font-medium hover:border-muted"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/signin"
                    className="rounded-lg px-2 py-2.5 text-sm font-medium text-muted hover:bg-surface hover:text-foreground"
                    onClick={() => setOpen(false)}
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/signup"
                    className="rounded-lg bg-accent px-4 py-2.5 text-center text-sm font-semibold text-accent-foreground"
                    onClick={() => setOpen(false)}
                  >
                    Get started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
