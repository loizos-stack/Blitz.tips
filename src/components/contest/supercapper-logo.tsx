import { cn } from "@/lib/utils";

// The Supercapper wordmark: the leading "S" is the Blitz.tips gold thunder bolt
// (bolt only — no green square), followed by "upercapper" in the display font.
// With `withContest`, a small "contest" sits beneath, tucked under the "pp".
// Sizes with the font (set the size via a text-* class); the word text inherits
// `currentColor`, so it works on light and dark.
export function SupercapperLogo({
  className,
  withContest = false,
}: {
  className?: string;
  withContest?: boolean;
}) {
  return (
    <span
      className={cn("relative inline-flex flex-col leading-none", className)}
      role="img"
      aria-label={withContest ? "Supercapper Contest" : "Supercapper"}
    >
      <span className="inline-flex items-baseline font-display font-extrabold tracking-tight">
        <svg viewBox="0 0 40 40" className="mr-[0.02em] h-[0.92em] w-[0.6em] self-center" fill="none" aria-hidden>
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
        <span>upercapper</span>
      </span>
      {withContest && (
        <span
          aria-hidden
          className="mt-[0.04em] pl-[52%] text-[0.24em] font-semibold uppercase tracking-[0.45em] text-current opacity-80"
        >
          contest
        </span>
      )}
    </span>
  );
}
