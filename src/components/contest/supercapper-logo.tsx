import Image from "next/image";
import { cn } from "@/lib/utils";

// The Supercapper wordmark: the leading "S" is a thunder bolt, followed by
// "upercapper" in the display font. Two colors only — the bolt and "capper"
// share the brand green, "uper" and the byline stay neutral. Pass `onDark` on a
// dark surface: the accent green is tuned for contrast on white and goes muddy
// on charcoal, so it steps up to green-500 there.
// A sub-line can sit beneath: `withContest` for "contest", `withByline` for
// "by Blitz.tips" — the attribution lockup, for anywhere the contest appears
// away from the site's own chrome (social, email, partner placements). Both
// together stack contest over the byline.
// Sizes with the font (set the size via a text-* class); the word text inherits
// `currentColor`, so it works on light and dark.
export function SupercapperLogo({
  className,
  withContest = false,
  withByline = false,
  onDark = false,
}: {
  className?: string;
  withContest?: boolean;
  withByline?: boolean;
  /** Lightens the green for placement on a dark background. */
  onDark?: boolean;
}) {
  const accent = onDark ? "text-[#22c55e]" : "text-accent";
  const label = [
    "Supercapper",
    withContest ? " Contest" : "",
    withByline ? " by Blitz.tips" : "",
  ].join("");

  return (
    <span
      className={cn("relative inline-flex flex-col leading-none", className)}
      role="img"
      aria-label={label}
    >
      <span className="inline-flex items-center font-display font-extrabold tracking-tight">
        {/* viewBox cropped tight to the bolt's bounds (no transparent padding)
            so it can sit flush against the "u". */}
        {/* Tilted 15° so the bolt reads as a strike rather than a static glyph.
            The rotation widens its footprint, hence the smaller negative margin
            than an upright bolt would need to sit against the "u". */}
        <svg
          viewBox="10.5 5.5 19 30.5"
          className={cn("-mr-[0.02em] h-[1.5em] w-[0.94em] rotate-[15deg]", accent)}
          fill="none"
          aria-hidden
        >
          {/* stroke is green-900: keeps the bolt's edge readable against both
              the word and a dark surface, without a third brand color. */}
          <path
            d="M22 6 L11 23 H18.5 L16 35 L29 19 H21.5 L24 6 Z"
            fill="currentColor"
            stroke="#14532d"
            strokeWidth="0.8"
            strokeLinejoin="round"
          />
        </svg>
        <span>uper</span>
        <span className={accent}>capper</span>
      </span>
      {withContest && (
        <span
          aria-hidden
          className="mt-[0.06em] self-center text-[0.24em] font-semibold uppercase tracking-[0.5em] text-current opacity-80"
        >
          contest
        </span>
      )}
      {withByline && (
        // The real Blitz.tips lockup — mark plus wordmark, same as the site
        // header — rather than a text imitation of it. Only the "by" is faded;
        // the logo itself stays at full strength.
        <span
          aria-hidden
          className={cn(
            "flex items-center gap-[0.3em] self-center text-[0.26em] font-semibold tracking-tight",
            withContest ? "mt-[0.6em]" : "mt-[0.35em]"
          )}
        >
          <span className="opacity-60">by</span>
          <Image src="/logo-mark.svg" alt="" width={40} height={40} className="h-[1.35em] w-[1.35em]" />
          <span>
            Blitz<span className={accent}>.tips</span>
          </span>
        </span>
      )}
    </span>
  );
}
