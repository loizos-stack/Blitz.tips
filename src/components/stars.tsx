import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

// Read-only star display. `value` may be fractional (e.g. an average of 4.3);
// stars are filled up to the rounded value.
export function Stars({ value, className = "h-4 w-4" }: { value: number; className?: string }) {
  const filled = Math.round(value);
  return (
    <span role="img" className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(className, n <= filled ? "fill-yellow-400 text-yellow-400" : "text-border")}
        />
      ))}
    </span>
  );
}
