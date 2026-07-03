import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="container-page flex flex-col items-center justify-between gap-4 py-10 text-sm text-muted md:flex-row">
        <p>&copy; {new Date().getFullYear()} Blitz.tips. All picks are for entertainment purposes only.</p>
        <div className="flex gap-6">
          <Link href="/leaderboard" className="hover:text-foreground">
            Leaderboard
          </Link>
          <Link href="/handicappers" className="hover:text-foreground">
            Handicappers
          </Link>
          <Link href="/pricing" className="hover:text-foreground">
            Become a Handicapper
          </Link>
        </div>
      </div>
    </footer>
  );
}
