import Image from "next/image";
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
 * Stake's official wordmark. Two files, same artwork: the supplied dark navy
 * for light surfaces, and a white knockout (alpha preserved, RGB forced white)
 * for dark ones — the navy is invisible on the promo banner otherwise.
 *
 * The source is 1000x555, so the height drives the size and the width follows
 * that ratio; `h-*` on the caller would distort it without the matching width.
 */
const LOGO_RATIO = 1000 / 555;

function StakeWordmark({ height, onDark }: { height: number; onDark?: boolean }) {
  return (
    <Image
      src={onDark ? "/stake-logo-white.webp" : "/stake-logo.webp"}
      alt="Stake.com"
      width={Math.round(height * LOGO_RATIO)}
      height={height}
      className="inline-block w-auto"
      style={{ height }}
    />
  );
}

export function StakeCta({
  sport,
  event,
  variant = "inline",
  onDark = false,
  className,
}: {
  /** Switches to the white knockout wordmark for dark surfaces. */
  onDark?: boolean;
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
        Bet this on <StakeWordmark height={22} onDark={onDark} /> <ArrowUpRight className="h-3.5 w-3.5" />
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
      Bet with <StakeWordmark height={18} onDark={onDark} /> <ArrowUpRight className="h-3 w-3" />
      <span className="ml-0.5 font-normal opacity-70">(ad)</span>
    </a>
  );
}
