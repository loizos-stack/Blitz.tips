import { cn } from "@/lib/utils";

// The Supercapper wordmark: the leading "S" is the Blitz.tips gold thunder bolt
// (bolt only — no green square), followed by "upercapper" in the display font.
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
}: {
  className?: string;
  withContest?: boolean;
  withByline?: boolean;
}) {
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
        <svg viewBox="10.5 5.5 19 30.5" className="-mr-[0.06em] h-[1.5em] w-[0.94em]" fill="none" aria-hidden>
          <defs>
            <linearGradient id="sc-bolt" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="100%" stopColor="#eab308" />
            </linearGradient>
          </defs>
          <path
            d="M22 6 L11 23 H18.5 L16 35 L29 19 H21.5 L24 6 Z"
            fill="url(#sc-bolt)"
            stroke="#ca8a04"
            strokeWidth="0.8"
            strokeLinejoin="round"
          />
        </svg>
        <span>uper</span>
        <span className="text-accent">capper</span>
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
          by Blitz<span className="text-accent">.tips</span>
        </span>
      )}
    </span>
  );
}
