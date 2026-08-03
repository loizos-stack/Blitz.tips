import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { contestPhase } from "@/lib/contest";
import { formatCents } from "@/lib/utils";
import { SupercapperLogo } from "@/components/contest/supercapper-logo";

/**
 * Slim strips that point each product at the other.
 *
 * Deliberately not the ContestPromoBanner: that's a card for a dashboard, where
 * a big block is welcome. Directly under a hero it would compete with the thing
 * the visitor just arrived for. These are one line tall — a mark, a sentence,
 * an arrow.
 */

/** Under the site hero: points at the contest. Hides once the contest is over. */
export async function ContestPromoStrip() {
  const contest = await prisma.contest.findFirst({ where: { slug: "supercapper" } });
  if (!contest) return null;
  const phase = contestPhase(contest);
  if (phase === "ended" || phase === "settled") return null;

  return (
    <Link
      href="/supercapper"
      className="group block border-b border-white/10 bg-[#0b0f14] text-white"
    >
      <div className="container-page flex flex-wrap items-center justify-center gap-x-4 gap-y-2 py-3 text-center">
        <SupercapperLogo withContest onDark className="text-lg" />
        <span className="text-sm text-white/70">
          <span className="font-semibold text-[#eab308]">
            {formatCents(contest.prizePoolCents)} guaranteed
          </span>{" "}
          · free to enter · best ROI wins
        </span>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#22c55e]">
          {phase === "live" ? "Enter now" : "See the contest"}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

/**
 * Under the contest hero: points back at the marketplace.
 *
 * Gold, landing straight after the charcoal hero — the colour break is what
 * makes it register instead of reading as more page. Text is near-black rather
 * than the site's usual tokens: the accent green and muted grey both go muddy
 * on gold, and this strip has to be legible at a glance or it isn't worth the
 * interruption.
 */
export function SitePromoStrip() {
  return (
    <Link
      href="/"
      className="group block border-y border-[#ca8a04] bg-gradient-to-r from-[#eab308] via-[#fbbf24] to-[#eab308] text-[#0b0f14]"
    >
      <div className="container-page flex flex-wrap items-center justify-center gap-x-4 gap-y-2 py-3.5 text-center">
        {/* One flex child, or the gap lands between the word and the TLD. */}
        <span className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
          <Image src="/logo-mark.svg" alt="" width={24} height={24} className="h-6 w-6" />
          <span>Blitz.tips</span>
        </span>
        <span className="text-sm font-medium text-[#0b0f14]/80">
          Follow and subscribe to handicappers with a verified track record
        </span>
        <span className="inline-flex items-center gap-1 text-sm font-bold underline-offset-2 group-hover:underline">
          Browse handicappers
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
