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
  bylineLink = true,
}: {
  className?: string;
  withContest?: boolean;
  withByline?: boolean;
  /** Lightens the green for placement on a dark background. */
  onDark?: boolean;
  /**
   * Whether the byline is its own link to blitz.tips. Set false when the whole
   * mark already sits inside a link (the nav) — nested anchors are invalid.
   */
  bylineLink?: boolean;
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
              padding) so it can sit against the "u". Tilted 20° — enough to
              read as a strike rather than a static glyph, while still holding
              the "S" position in the word; past that the bolt detaches and the
              word starts reading as "upercapper" beside an icon. The tilt
              widens its footprint enough to need no negative margin. Solid
              gold with a deeper gold edge, so it holds its silhouette against
              both a white and a black background without depending on the
              surrounding text color. */}
          <svg
            viewBox="10.5 5.5 19 30.5"
            className="h-[1.5em] w-[0.94em] rotate-[20deg]"
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
          {/* The bolt IS the S, but only visually — in the text layer the
              wordmark read "upercapper", which is what a crawler, a copy-paste
              and a plain-text extractor all see. This puts the letter back in
              the DOM without drawing it twice. */}
          <span className="sr-only">S</span>
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

      {withByline &&
        (() => {
          // The real Blitz.tips lockup — mark plus wordmark, same pairing as the
          // site header — rather than a text imitation of it. Only the "by" is
          // faded; the logo itself stays at full strength.
          const className = cn(
            "flex items-center gap-[0.3em] self-end text-[0.26em] font-semibold tracking-tight",
            bylineLink && "hover:opacity-80",
            withContest ? "mt-[0.7em]" : "mt-[0.35em]"
          );
          const content = (
            <>
              <span aria-hidden className="opacity-60">
                by
              </span>
              <Image src="/logo-mark.svg" alt="" width={40} height={40} className="h-[1.35em] w-[1.35em]" />
              <span aria-hidden>
                Blitz<span className={accent}>.tips</span>
              </span>
            </>
          );

          // Its own link normally, so the attribution leads somewhere. Plain
          // text when the caller has already wrapped the whole mark in a link.
          return bylineLink ? (
            <a href={BLITZ_URL} aria-label="Blitz.tips" className={className}>
              {content}
            </a>
          ) : (
            <span aria-label="by Blitz.tips" role="img" className={className}>
              {content}
            </span>
          );
        })()}
    </span>
  );
}
