import Image from "next/image";
import { cn } from "@/lib/utils";

const BLITZ_URL = "https://blitz.tips";

// The Supercapper wordmark: the leading "S" is a gold thunder bolt, followed by
// "upercapper" in the display font — "uper" takes the surrounding text color
// (black on light, white reversed) and "capper" carries the brand green. Pass
// `onDark` on a dark surface: the accent green is tuned for contrast on white
// and goes muddy on charcoal, so it steps up to green-500 there. The gold needs
// no such treatment; it holds on both.
// A sub-line can sit beneath: `withContest` for "Handicapping Contest",
// `withByline` for the Blitz.tips attribution lockup, which links back to the
// site — for anywhere the contest appears away from the site's own chrome
// (social, email, partner placements). Both together stack tagline over byline.
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

  return (
    <span className={cn("relative inline-flex flex-col leading-none", className)}>
      {/* The mark itself is one image to a screen reader. The byline below is a
          real link, so it sits outside this role="img" rather than inside it,
          where its contents would be announced as presentational. */}
      <span
        role="img"
        aria-label={withContest ? "Supercapper Handicapping Contest" : "Supercapper"}
        className="inline-flex flex-col"
      >
        <span className="inline-flex items-center font-display font-extrabold tracking-tight">
          {/* viewBox is cropped tight to the bolt's bounds (no transparent
              padding) so it can sit against the "u". Tilted 30° so it reads as
              a strike rather than a static glyph; that tilt widens its
              footprint enough that it needs no negative margin at all. Solid
              gold with a deeper gold edge, so it holds its silhouette against
              both a white and a black background without depending on the
              surrounding text color. */}
          <svg
            viewBox="10.5 5.5 19 30.5"
            className="h-[1.5em] w-[0.94em] rotate-[30deg]"
            fill="none"
            aria-hidden
          >
            <path
              d="M22 6 L11 23 H18.5 L16 35 L29 19 H21.5 L24 6 Z"
              fill="#eab308"
              stroke="#ca8a04"
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </svg>
          <span>uper</span>
          <span className={accent}>capper</span>
        </span>
        {withContest && (
          <span
            aria-hidden
            className="mt-[0.14em] self-center text-[0.185em] font-semibold uppercase tracking-[0.34em] text-current opacity-80"
          >
            Handicapping Contest
          </span>
        )}
      </span>

      {withByline && (
        // The real Blitz.tips lockup — mark plus wordmark, same pairing as the
        // site header — rather than a text imitation of it, and clickable so the
        // attribution actually leads somewhere. Only the "by" is faded; the logo
        // itself stays at full strength.
        <a
          href={BLITZ_URL}
          aria-label="Blitz.tips"
          className={cn(
            "flex items-center gap-[0.3em] self-end text-[0.26em] font-semibold tracking-tight hover:opacity-80",
            withContest ? "mt-[0.7em]" : "mt-[0.35em]"
          )}
        >
          <span aria-hidden className="opacity-60">
            by
          </span>
          <Image src="/logo-mark.svg" alt="" width={40} height={40} className="h-[1.35em] w-[1.35em]" />
          <span aria-hidden>
            Blitz<span className={accent}>.tips</span>
          </span>
        </a>
      )}
    </span>
  );
}
