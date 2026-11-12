import Link from "next/link";
import Image from "next/image";

const COLUMNS = [
  {
    heading: "Product",
    links: [
      { href: "/leaderboard", label: "Leaderboard" },
      { href: "/handicappers", label: "Handicappers" },
      { href: "/buy-picks", label: "Buy Tips" },
      { href: "/pricing", label: "Sell Tips" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/about", label: "About Blitz" },
      { href: "/blog", label: "Blog" },
      { href: "/faq", label: "FAQ" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/terms", label: "Terms & Conditions" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/refunds", label: "Refund Policy" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-white/10 bg-[#0b0f14] text-white">
      <div className="container-page py-12">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-xs">
            <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-white">
              <Image src="/logo-mark.svg" alt="" width={28} height={28} className="h-7 w-7" />
              <span>
                Blitz<span className="text-green-400">.tips</span>
              </span>
            </Link>
            <p className="mt-3 text-sm text-white/60">
              The marketplace for verified sports handicappers. Every pick tracked, graded, and ranked.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLUMNS.map((col) => (
              <div key={col.heading}>
                <p className="text-xs font-semibold uppercase tracking-wide text-white/50">{col.heading}</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-sm text-white/70 hover:text-white">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-xs text-white/50">
          <p>&copy; {new Date().getFullYear()} Blitz.tips. All picks are for entertainment purposes only.</p>
          <p className="mt-1">
            You must be of legal age to gamble in your jurisdiction. Please bet responsibly — if gambling
            stops being fun, call 1-800-GAMBLER.
          </p>
          {/* Paid-partnership disclosure. Sits here once rather than as an
              "(ad)" tag on every outbound link — the FTC and the UK ASA both
              require the connection to be disclosed, but neither requires it
              per-link, so one clear site-wide statement keeps the board clean
              and the obligation met. */}
          <p className="mt-1">
            Blitz.tips earns a commission on sportsbook links. Sportsbook availability depends on your
            jurisdiction.
          </p>
        </div>
      </div>
    </footer>
  );
}
