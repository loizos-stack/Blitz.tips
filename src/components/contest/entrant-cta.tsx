import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { CapperList, type CapperRow } from "@/components/contest/capper-list";

/**
 * Conversion block on a public entrant page. These pages get shared — an entrant
 * posts their record and the people who click through are cold traffic that
 * otherwise sees no reason to come back. Two paths out: enter the contest
 * yourself (free, and the site's cheapest acquisition), or subscribe to someone
 * already beating this record.
 *
 * Never rendered for the entrant themselves — they get the dashboard link
 * instead.
 */
export function EntrantCta({
  entrantName,
  signedIn,
  entered,
  cappers,
}: {
  entrantName: string;
  signedIn: boolean;
  /** True when the viewer already has an entry — then the pitch is "post picks", not "join". */
  entered: boolean;
  cappers: CapperRow[];
}) {
  return (
    <div className="mt-10 grid gap-4 sm:grid-cols-2">
      <div className="card border-accent/40 bg-accent/5 p-5">
        <p className="flex items-center gap-2 font-semibold">
          <Trophy className="h-5 w-5 text-accent" /> Think you can beat this?
        </p>
        <p className="mt-2 text-sm text-muted">
          {entered
            ? `You're already in — the only thing between you and ${entrantName} is picks on the board.`
            : "The Supercapper contest is free to enter and pays a $10,000 guaranteed prize pool. Post your picks, get graded in public, climb the standings."}
        </p>
        <Link
          href={entered ? "/supercapper/dashboard" : "/supercapper"}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
        >
          {entered ? "Post your picks" : signedIn ? "Enter the contest" : "Enter free"}{" "}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {cappers.length > 0 && (
        <div className="card p-5">
          <p className="font-semibold">Records beating this one</p>
          <p className="mt-1 text-xs text-muted">
            Verified handicappers on Blitz.tips, graded the same way.
          </p>
          <div className="mt-3">
            <CapperList cappers={cappers} />
          </div>
          <Link
            href="/handicappers"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
          >
            Browse all handicappers <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
