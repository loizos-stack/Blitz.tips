import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
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
    </div>
  );
}
