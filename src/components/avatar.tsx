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

// A handicapper's profile picture, falling back to their initials when no
// avatar has been uploaded.
export function Avatar({
  src,
  name,
  className,
}: {
  src?: string | null;
  name: string;
  className?: string;
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
