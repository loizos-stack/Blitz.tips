import Link from "next/link";

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
      { href: "/about", label: "About us" },
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
    <footer className="mt-auto border-t border-border">
      <div className="container-page py-12">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-xs">
            <p className="text-lg font-bold tracking-tight">
              Blitz<span className="text-accent">.tips</span>
            </p>
            <p className="mt-3 text-sm text-muted">
              The marketplace for verified sports handicappers. Every pick tracked, graded, and ranked.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLUMNS.map((col) => (
              <div key={col.heading}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{col.heading}</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-sm text-muted hover:text-foreground">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6 text-xs text-muted">
          <p>&copy; {new Date().getFullYear()} Blitz.tips. All picks are for entertainment purposes only.</p>
          <p className="mt-1">
            You must be of legal age to gamble in your jurisdiction. Please bet responsibly — if gambling
            stops being fun, call 1-800-GAMBLER.
          </p>
        </div>
      </div>
    </footer>
  );
}
