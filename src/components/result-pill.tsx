import { cn } from "@/lib/utils";
import type { PickResult } from "@prisma/client";

const styles: Record<PickResult, string> = {
  WIN: "bg-accent/15 text-accent",
  LOSS: "bg-danger/15 text-danger",
  PUSH: "bg-push/15 text-push",
  VOID: "bg-push/15 text-push",
  PENDING: "bg-gold/15 text-gold",
};

const labels: Record<PickResult, string> = {
  WIN: "Win",
  LOSS: "Loss",
  PUSH: "Push",
  VOID: "Void",
  PENDING: "Pending",
};

export function ResultPill({ result }: { result: PickResult }) {
  return <span className={cn("result-pill", styles[result])}>{labels[result]}</span>;
}
