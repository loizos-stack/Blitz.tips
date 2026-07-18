import { cn } from "@/lib/utils";

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
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- user-uploaded avatar; kept as a plain <img> (varied sizes across call sites) with lazy loading
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
