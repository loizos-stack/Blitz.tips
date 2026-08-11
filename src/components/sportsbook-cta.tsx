import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { StakeCta } from "@/components/stake-cta";
import { oneWinGoHref } from "@/lib/onewin";
import type { Sportsbook } from "@/lib/sportsbooks";
import type { PickSport } from "@prisma/client";

/**
 * Renders whichever sportsbook this visitor gets, or nothing.
 *
 * Callers pass the result of `sportsbookForVisitor()` rather than a boolean per
 * book. That keeps the decision in one server-side place and makes "show both"
 * and "show neither by accident" unrepresentable at the call site.
 *
 * `rel="sponsored"` is required by Google for affiliate links; `noopener` is
 * standard for target=_blank. The paid-partnership disclosure lives once in the
 * footer rather than on every link.
 */

/**
 * 1win's wordmark, set in the site's own type rather than as an image.
 *
 * Deliberate: an approximated logo is worse than no logo, and tracing a
 * trademarked wordmark by hand produces something subtly wrong that reads as
 * counterfeit next to the real thing. Drop the official SVG from the affiliate
 * dashboard at public/1win-logo.svg and this becomes an <Image>, exactly like
 * StakeCta does with its supplied artwork.
 */
function OneWinWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-extrabold tracking-tight", className)}>
      1win
    </span>
  );
}

interface Props {
  /** From sportsbookForVisitor(). Null renders nothing at all. */
  book: Sportsbook | null;
  sport?: PickSport | string | null;
  /** Carried for click analytics only — neither book has a per-match URL we can build. */
  event?: string | null;
  variant?: "inline" | "button";
  onDark?: boolean;
  className?: string;
}

export function SportsbookCta({ book, sport, event, variant = "inline", onDark = false, className }: Props) {
  if (book === null) return null;
  if (book === "stake") {
    return <StakeCta sport={sport} event={event} variant={variant} onDark={onDark} className={className} />;
  }

  const href = oneWinGoHref({ sport, event });

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
        Bet on <OneWinWordmark className="text-sm" /> <ArrowUpRight className="h-3.5 w-3.5" />
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
      Bet on <OneWinWordmark className="text-xs" /> <ArrowUpRight className="h-3 w-3" />
    </a>
  );
}
