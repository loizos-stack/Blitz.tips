import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Compact progress indicator for the signup onboarding steps.
export function OnboardingStepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="mb-6 flex items-center justify-center gap-2">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                done && "bg-accent text-accent-foreground",
                active && "bg-accent/15 text-accent ring-1 ring-accent",
                !done && !active && "bg-surface-raised text-muted"
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={cn("hidden text-xs font-medium sm:block", active ? "text-foreground" : "text-muted")}>
              {label}
            </span>
            {i < steps.length - 1 && <span className="h-px w-4 bg-border sm:w-6" />}
          </li>
        );
      })}
    </ol>
  );
}
