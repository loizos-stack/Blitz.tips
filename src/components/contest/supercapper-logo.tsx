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
        <svg
          viewBox="10.5 5.5 19 30.5"
          className={cn("-mr-[0.06em] h-[1.5em] w-[0.94em]", accent)}
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
        // Lower contrast and no letterspacing so it reads as attribution rather
        // than a second wordmark. "Blitz" stays neutral and ".tips" takes the
        // accent — the same split the site header uses.
        <span
          aria-hidden
          className={cn(
            "self-center text-[0.26em] font-semibold tracking-tight opacity-70",
            withContest ? "mt-[0.6em]" : "mt-[0.35em]"
          )}
        >
          by Blitz<span className={accent}>.tips</span>
        </span>
      )}
    </span>
  );
}
