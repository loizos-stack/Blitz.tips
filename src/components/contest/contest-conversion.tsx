import Link from "next/link";
import { TrendingUp, ArrowRight, Users } from "lucide-react";
import { CapperList, type CapperRow } from "@/components/contest/capper-list";

/**
 * Conversion prompts on the contest dashboard. Contest entrants are the warmest
 * audience on the site — they post picks daily and are building a graded record
 * in public — so this turns that activity into the two things that actually earn:
 *
 *  1. Entrant -> handicapper. Someone posting a profitable record for free is a
 *     handicapper who hasn't monetized yet. Shown only once they have enough
 *     graded picks to have proven something, and only if they're actually up —
 *     pitching "sell your picks" to a losing entrant is both tacky and bad for
 *     the marketplace.
 *  2. Entrant -> subscriber. Entrants who are behind get shown cappers currently
 *     beating them, which is the honest version of the pitch.
 *
 * Deliberately restrained: one card at a time, no card at all before the
 * entrant has a meaningful sample.
 */

const MIN_PICKS_FOR_PITCH = 15;

export function ContestConversion({
  settledPicks,
  roi,
  unitsNet,
  isHandicapper,
  betterCappers,
  minPicks,
}: {
  settledPicks: number;
  roi: number | null;
  unitsNet: number;
  isHandicapper: boolean;
  /** Cappers currently outperforming this entrant, best first. */
  betterCappers: CapperRow[];
  minPicks: number;
}) {
  // Too early to say anything meaningful about their record.
  if (settledPicks < MIN_PICKS_FOR_PITCH) return null;

  const winning = roi != null && roi > 0 && unitsNet > 0;

  // Profitable and not already selling picks — the highest-value conversion.
  if (winning && !isHandicapper) {
    return (
      <div className="card border-accent/40 bg-accent/5 p-5">
        <p className="flex items-center gap-2 font-semibold">
          <TrendingUp className="h-5 w-5 text-accent" /> You&apos;re running a profitable book
        </p>
        <p className="mt-2 text-sm text-muted">
          <span className="font-semibold text-accent">
            {unitsNet > 0 ? "+" : ""}
            {unitsNet}u
          </span>{" "}
          at <span className="font-semibold text-accent">{roi > 0 ? "+" : ""}{roi.toFixed(1)}% ROI</span> over{" "}
          {settledPicks} graded picks — and you&apos;re giving it away free. Cappers with records like yours charge
          for their picks on Blitz.tips, and your contest record already proves it.
        </p>
        <Link
          href="/dashboard/handicapper"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
        >
          Start selling your picks <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="mt-2 text-xs text-muted">
          Free to start — you keep 80% of every subscription. Your contest picks stay separate and stay free.
        </p>
      </div>
    );
  }

  // Behind the field — show who's beating them. No pitch if we've nobody to show.
  if (betterCappers.length === 0) return null;

  return (
    <div className="card p-5">
      <p className="flex items-center gap-2 font-semibold">
        <Users className="h-5 w-5 text-accent" /> Cappers beating your number
      </p>
      <p className="mt-1 text-xs text-muted">
        {roi != null
          ? `You're at ${roi > 0 ? "+" : ""}${roi.toFixed(1)}% ROI over ${settledPicks} graded picks.`
          : `You've got ${settledPicks} of ${minPicks} graded picks so far.`}{" "}
        These verified records are ahead of you right now.
      </p>
      <div className="mt-3">
        <CapperList cappers={betterCappers} />
      </div>
      <Link
        href="/handicappers"
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
      >
        Browse all handicappers <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
