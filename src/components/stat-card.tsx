import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  sub,
  subTone = "muted",
  tone = "default",
}: {
  label: string;
  value: string;
  // Optional secondary line under the main value (e.g. units for a record).
  sub?: string;
  subTone?: "muted" | "accent" | "danger";
  tone?: "default" | "accent" | "danger";
}) {
  return (
    <div className="card px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-bold tabular-nums",
          tone === "accent" && "text-accent",
          tone === "danger" && "text-danger"
        )}
      >
        {value}
      </p>
      {sub && (
        <p
          className={cn(
            "mt-0.5 text-xs font-medium tabular-nums",
            subTone === "muted" && "text-muted",
            subTone === "accent" && "text-accent",
            subTone === "danger" && "text-danger"
          )}
        >
          {sub}
        </p>
      )}
    </div>
  );
}
