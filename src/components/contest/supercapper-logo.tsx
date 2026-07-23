import { cn } from "@/lib/utils";

// The Supercapper wordmark: the leading "S" is the Blitz.tips thunder mark
// (green rounded square + gold bolt), followed by "upercapper" in the display
// font. Sizes with the font — set the size via a text-* class on `className`.
// The word text inherits `currentColor`, so it works on light and dark.
export function SupercapperLogo({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center font-display font-extrabold leading-none tracking-tight", className)}
      role="img"
      aria-label="Supercapper"
    >
      <span
        aria-hidden
        className="relative inline-flex items-center justify-center rounded-[0.26em] bg-accent shadow-sm"
        style={{ height: "1.16em", width: "1.16em" }}
      >
        <svg viewBox="0 0 40 40" className="h-[0.82em] w-[0.82em]" fill="none">
          <defs>
            <linearGradient id="sc-bolt" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="100%" stopColor="#eab308" />
            </linearGradient>
          </defs>
          <path
            d="M22 6 L11 23 H18.5 L16 35 L29 19 H21.5 L24 6 Z"
            fill="url(#sc-bolt)"
            stroke="#fef9c3"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="ml-[0.08em]">upercapper</span>
    </span>
  );
}
