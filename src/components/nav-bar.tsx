"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Menu, X, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notification-bell";

const links = [
  { href: "/about", label: "About Blitz" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/handicappers", label: "Handicappers" },
  { href: "/buy-picks", label: "Buy Tips" },
  { href: "/pricing", label: "Sell Tips" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export function NavBar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // While the side drawer is open, lock body scroll and close on Escape.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b0f14]/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-display font-bold text-lg tracking-tight text-white">
          <Image src="/logo-mark.svg" alt="" width={28} height={28} className="h-7 w-7" priority />
          <span>Blitz<span className="text-green-400">.tips</span></span>
        </Link>

        <div className="flex items-center gap-2">
          {status === "authenticated" && <NotificationBell />}
          {/* Auth actions stay inline on larger screens; everything else lives
              behind the menu button at every size. */}
          <div className="hidden md:flex items-center gap-3">
            {status === "authenticated" ? (
              <>
                {session.user.role === "ADMIN" && (
                  <Link href="/admin" className="text-sm font-medium text-gold hover:text-white">
                    Admin
                  </Link>
                )}
                <Link
                  href="/account"
                  title="Account settings"
                  className="flex items-center gap-1.5 text-sm font-medium text-white/90 hover:text-white"
                >
                  <UserCircle className="h-5 w-5" />
                  <span className="max-w-[10rem] truncate">
                    {session.user.username ?? session.user.name ?? "Account"}
                  </span>
                </Link>
                <Link
                  href="/welcome"
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
            className="text-white"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>
      </header>

      {/* Backdrop */}
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-black/60 transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      {/* Slide-in drawer. `inert` while closed keeps its links out of the tab
          order and the accessibility tree (aria-hidden alone would leave the
          descendants focusable). */}
      <aside
        inert={!open}
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-72 max-w-[82vw] flex-col border-l border-white/10 bg-[#0b0f14] shadow-2xl transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-4">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-white"
          >
            <Image src="/logo-mark.svg" alt="" width={26} height={26} className="h-6 w-6" />
            <span>Blitz<span className="text-green-400">.tips</span></span>
          </Link>
          <button onClick={() => setOpen(false)} aria-label="Close menu" className="text-white/80 hover:text-white">
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-lg px-2 py-2.5 text-sm font-bold hover:bg-white/5 hover:text-white",
                pathname?.startsWith(link.href) ? "bg-white/5 text-white" : "text-white/90"
              )}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-2 flex flex-col gap-2 border-t border-white/10 pt-3 md:hidden">
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
                  href="/account"
                  className="flex items-center gap-2 rounded-lg px-2 py-2.5 text-sm font-medium text-white/90 hover:bg-white/5 hover:text-white"
                  onClick={() => setOpen(false)}
                >
                  <UserCircle className="h-5 w-5" />
                  <span className="truncate">
                    {session.user.username ?? session.user.name ?? "Account"}
                  </span>
                </Link>
                <Link
                  href="/welcome"
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
        </nav>
      </aside>
    </>
  );
}
