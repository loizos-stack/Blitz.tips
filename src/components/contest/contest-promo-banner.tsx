import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { contestPhase, payoutSpotsForEntrants } from "@/lib/contest";
import { formatCents } from "@/lib/utils";
import { SupercapperLogo } from "@/components/contest/supercapper-logo";

// Self-contained promo card for the live contest. Renders nothing once the
// contest has ended or settled, so it disappears on its own.
export async function ContestPromoBanner({ className }: { className?: string }) {
  const contest = await prisma.contest.findFirst({ where: { slug: "supercapper" } });
  if (!contest) return null;
  const phase = contestPhase(contest);
  if (phase === "ended" || phase === "settled") return null;

  let winners = contest.prizeSplitCents.length;
  if (contest.dynamicPayouts) {
    const activeCount = await prisma.contestEntry.count({
      where: { contestId: contest.id, disqualifiedAt: null },
    });
    winners = payoutSpotsForEntrants(activeCount);
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f14] p-6 text-white sm:p-8 ${className ?? ""}`}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/25 via-transparent to-gold/25" />
      <div className="relative flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-xs font-semibold text-gold">
            <Trophy className="h-3.5 w-3.5" /> {phase === "live" ? "Live now" : "Now open"}
          </span>
          <div className="mt-3">
            <SupercapperLogo withContest className="text-2xl sm:text-3xl" />
          </div>
          <p className="mt-2 text-sm text-white/70">
            Post your picks and compete for the{" "}
            <span className="font-semibold text-accent">{formatCents(contest.prizePoolCents)} guaranteed</span> pool —
            free to enter, top {winners} paid by best ROI.
          </p>
        </div>
        <Link
          href="/supercapper"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground hover:opacity-90"
        >
          Enter the contest <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
