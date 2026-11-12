import Image from "next/image";
import { cn } from "@/lib/utils";

// Hosts whitelisted in next.config's images.remotePatterns — only these get
// routed through next/image (resized to the small displayed size, served as
// WebP/AVIF). Anything else (or a data URI) renders as a plain lazy <img>.
const OPTIMIZABLE_HOST = /(^|\.)(public\.blob\.vercel-storage\.com|googleusercontent\.com)$/i;

function isOptimizable(url: string): boolean {
  try {
    return OPTIMIZABLE_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

// A profile picture, with a choice of what to show when there isn't one.
//
// The fallback is a prop rather than a fixed default because this renders two
// different kinds of person. A HANDICAPPER with no picture gets the Blitz.tips
// mark: they are the product on this site, and a branded circle reads as
// deliberate where two letters read as a broken image. A REVIEW AUTHOR does
// not — stamping the site's own logo on a customer's review would suggest the
// review came from Blitz.tips. Initials stay the default so a new caller has
// to opt in to the brand rather than borrow it by accident.
export function Avatar({
  src,
  name,
  className,
  fallback = "initials",
}: {
  src?: string | null;
  name: string;
  className?: string;
  fallback?: "initials" | "logo";
}) {
  if (src && isOptimizable(src)) {
    // Optimized: the uploaded avatar is stored at ~400px but shown at 40–96px,
    // so next/image serves a right-sized, modern-format copy. The className
    // carries the size/shape/border; the image fills it.
    return (
      <span className={cn("relative inline-block overflow-hidden", className)}>
        <Image src={src} alt={name} fill sizes="128px" className="object-cover" />
      </span>
    );
  }

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- non-whitelisted host or data URI; plain lazy img
    return <img src={src} alt={name} loading="lazy" decoding="async" className={cn("object-cover", className)} />;
  }

  if (fallback === "logo") {
    // The mark is a green tile with the bolt on it, so it fills whatever shape
    // the caller's className sets — a circle on the cards, a square in the
    // profile editor — rather than sitting as a small logo on a blank ground.
    // Not next/image: this is a 0.5KB local SVG, which the optimizer would not
    // make smaller and does not process by default anyway.
    return (
      <span className={cn("relative inline-block overflow-hidden bg-accent", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- local SVG, nothing to optimize */}
        <img
          src="/logo-mark.svg"
          alt={name}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </span>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center bg-surface-raised font-bold uppercase text-muted",
        className
      )}
    >
      {name.slice(0, 2)}
    </div>
  );
}
