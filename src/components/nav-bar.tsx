"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Menu, X } from "lucide-react";
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
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b0f14]/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight text-white">
          <Image src="/logo-mark.svg" alt="" width={28} height={28} className="h-7 w-7" priority />
          <span>Blitz<span className="text-accent">.tips</span></span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-bold transition-colors hover:text-white",
                pathname?.startsWith(link.href) ? "text-white" : "text-white/90"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {status === "authenticated" ? (
            <>
              {session.user.role === "ADMIN" && (
                <Link href="/admin" className="text-sm font-medium text-gold hover:text-white">
                  Admin
                </Link>
              )}
              <Link
                href={session.user.role === "HANDICAPPER" ? "/dashboard/handicapper" : "/dashboard"}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
              >
                Go to Dashboard
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white hover:border-white/40"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/signin" className="text-sm font-bold text-white/90 hover:text-white">
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
          className="md:hidden text-white"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-white/10 bg-[#0b0f14]">
          <div className="container-page flex flex-col gap-1 py-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-2 py-2.5 text-sm font-bold text-white/90 hover:bg-white/5 hover:text-white"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-white/10 pt-3">
              {status === "authenticated" ? (
                <>
                  {session.user.role === "ADMIN" && (
                    <Link
                      href="/admin"
                      className="rounded-lg px-2 py-2.5 text-sm font-medium text-gold hover:bg-white/5"
                      onClick={() => setOpen(false)}
                    >
                      Admin
                    </Link>
                  )}
                  <Link
                    href={session.user.role === "HANDICAPPER" ? "/dashboard/handicapper" : "/dashboard"}
                    className="rounded-lg bg-accent px-4 py-2.5 text-center text-sm font-semibold text-accent-foreground"
                    onClick={() => setOpen(false)}
                  >
                    Go to Dashboard
                  </Link>
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="rounded-lg border border-white/20 px-4 py-2.5 text-left text-sm font-medium text-white hover:border-white/40"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/signin"
                    className="rounded-lg px-2 py-2.5 text-sm font-bold text-white/90 hover:bg-white/5 hover:text-white"
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
