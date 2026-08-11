import Image from "next/image";
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
 * 1win's wordmark. Two files, same shape as Stake's: the dark version for light
 * surfaces and a white knockout for dark ones.
 *
 * These are rendered by scripts/build-sportsbook-logos.mjs and are a stand-in,
 * not 1win's official artwork — see that file. Swapping in the real asset means
 * overwriting the two files and changing LOGO_RATIO to match.
 *
 * Height drives the size and width follows the ratio; setting height alone via
 * a class would distort it.
 */
// Measured from the rendered glyphs by scripts/build-sportsbook-logos.mjs,
// which prints the value to paste here. Swapping in 1win's official artwork
// means changing this one number to match its proportions.
const LOGO_RATIO = 1.9381;

function OneWinWordmark({ height, onDark }: { height: number; onDark?: boolean }) {
  return (
    <Image
      src={onDark ? "/1win-logo-white.png" : "/1win-logo.png"}
      alt="1win"
      width={Math.round(height * LOGO_RATIO)}
      height={height}
      className="inline-block w-auto"
      style={{ height }}
    />
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
          "inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:border-accent hover:text-accent",
          className
        )}
      >
        Bet on <OneWinWordmark height={30} onDark={onDark} /> <ArrowUpRight className="h-4 w-4" />
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="sponsored noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-accent",
        className
      )}
    >
      Bet on <OneWinWordmark height={24} onDark={onDark} /> <ArrowUpRight className="h-4 w-4" />
    </a>
  );
}
