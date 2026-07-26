import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { stakeGoHref } from "@/lib/stake";
import type { PickSport } from "@prisma/client";

/**
 * Stake.com affiliate CTA. Rendered only where the caller has already
 * established the visitor is outside the US (lib/geo) — this component does not
 * check, so don't drop it in without that gate.
 *
 * Note what it does NOT say: it never attributes the displayed prices to Stake.
 * The odds on this site come from the books our feed actually quotes, and the
 * attribution line names that book. This is a "bet with" link — a partner CTA —
 * which is what an affiliate relationship actually is.
 *
 * `rel="sponsored"` is required by Google for paid/affiliate links; `noopener`
 * is standard for target=_blank.
 */

/**
 * Stake's name as text. Their official logo belongs here instead — download the
 * SVG from the affiliate creative pack, drop it in public/, and swap this span
 * for an <Image>. Kept as text so nothing renders a broken asset in the
 * meantime, and so we're not shipping an approximation of someone's trademark.
 */
function StakeWordmark({ className }: { className?: string }) {
  return <span className={cn("font-display font-bold tracking-tight", className)}>Stake.com</span>;
}

export function StakeCta({
  sport,
  event,
  variant = "inline",
  className,
}: {
  sport?: PickSport | string | null;
  /** Carried for click analytics only — Stake has no per-match URL we can build. */
  event?: string | null;
  /** "inline" sits under an odds block; "button" is a standalone action. */
  variant?: "inline" | "button";
  className?: string;
}) {
  const href = stakeGoHref({ sport, event });

  if (variant === "button") {
    return (
      <a
        href={href}
        target="_blank"
        rel="sponsored noopener noreferrer"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-accent hover:text-accent",
          className
        )}
      >
        Bet this on <StakeWordmark /> <ArrowUpRight className="h-3.5 w-3.5" />
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="sponsored noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-medium text-muted hover:text-accent",
        className
      )}
    >
      Bet with <StakeWordmark className="text-[11px]" /> <ArrowUpRight className="h-3 w-3" />
      <span className="ml-0.5 font-normal opacity-70">(ad)</span>
    </a>
  );
}
