"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gift, X } from "lucide-react";
import { formatDate } from "@/lib/date-format";
import { cn } from "@/lib/utils";

/**
 * Give a handicapper Silver or Gold for a period, from the handicappers table.
 *
 * This replaced a bare plan dropdown that set the plan directly. That control
 * had no end date, sent nothing, and would happily write over a live Stripe
 * subscription — leaving someone paying for a plan they had been given. A comp
 * is a gift with a date on it, so the control asks for both and the server
 * refuses the cases that would cost someone money.
 */

const DURATIONS = [
  { days: 1, label: "1 day" },
  { days: 3, label: "3 days" },
  { days: 7, label: "1 week" },
  { days: 14, label: "2 weeks" },
  { days: 30, label: "1 month" },
  { days: 60, label: "2 months" },
  { days: 90, label: "3 months" },
  { days: 180, label: "6 months" },
  { days: 365, label: "1 year" },
];

export function CompPlanControl({
  handicapperId,
  handle,
  plan,
  compedUntil,
  blockedReason,
}: {
  handicapperId: string;
  handle: string;
  plan: string;
  /** ISO string while a comp is running, else null. */
  compedUntil: string | null;
  /** Set when they pay through Stripe, so a comp must not be offered. */
  blockedReason: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPlan, setNextPlan] = useState<"SILVER" | "GOLD">("GOLD");
  const [days, setDays] = useState(30);

  const endpoint = `/api/admin/handicappers/${handicapperId}/comp`;

  async function call(init: RequestInit) {
    setBusy(true);
    setError(null);
    const res = await fetch(endpoint, init);
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(typeof body.error === "string" ? body.error : "That didn't work.");
      return;
    }
    router.refresh();
  }

  // Paying for real: say so and offer nothing. The reason is the point — an
  // admin who can't see why the control is missing will assume it's broken.
  if (blockedReason) {
    return (
      <div className="max-w-[16rem]">
        <span className="text-xs font-medium">{titleCase(plan)}</span>
        <p className="mt-0.5 text-[11px] leading-snug text-muted">{blockedReason}</p>
      </div>
    );
  }

  if (compedUntil) {
    return (
      <div className="flex flex-col items-start gap-1">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            plan === "GOLD" ? "bg-gold/15 text-gold" : "bg-muted/15 text-muted"
          )}
        >
          <Gift className="h-3 w-3" aria-hidden />
          {titleCase(plan)}
        </span>
        <span className="text-[11px] text-muted">Comped to {formatDate(compedUntil)}</span>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (
              !confirm(
                `End @${handle}'s comped ${titleCase(plan)} now and return them to Free? They won't be emailed — the expiry email says the plan ran out, which wouldn't be true.`
              )
            )
              return;
            void call({ method: "DELETE" });
          }}
          className="inline-flex items-center gap-0.5 text-[11px] font-medium text-danger hover:underline disabled:opacity-60"
        >
          <X className="h-3 w-3" aria-hidden /> Revoke
        </button>
        {error && <span className="text-[11px] text-danger">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-1">
        <select
          aria-label={`Plan to give @${handle}`}
          value={nextPlan}
          disabled={busy}
          onChange={(e) => setNextPlan(e.target.value as "SILVER" | "GOLD")}
          className="cursor-pointer rounded-lg border border-border bg-surface px-1.5 py-1 text-xs font-medium outline-none hover:border-muted disabled:opacity-50"
        >
          <option value="GOLD">Gold</option>
          <option value="SILVER">Silver</option>
        </select>
        <select
          aria-label={`How long @${handle} keeps it`}
          value={days}
          disabled={busy}
          onChange={(e) => setDays(Number(e.target.value))}
          className="cursor-pointer rounded-lg border border-border bg-surface px-1.5 py-1 text-xs font-medium outline-none hover:border-muted disabled:opacity-50"
        >
          {DURATIONS.map((d) => (
            <option key={d.days} value={d.days}>
              {d.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void call({
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ plan: nextPlan, days }),
            })
          }
          className="rounded-lg bg-accent px-2 py-1 text-xs font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Giving…" : "Give"}
        </button>
      </div>
      <span className="text-[11px] text-muted">
        {plan === "FREE" ? "Free" : `${titleCase(plan)} — not comped`}
        {days < 3 && " · too short for a reminder"}
      </span>
      {error && <span className="max-w-[16rem] text-[11px] leading-snug text-danger">{error}</span>}
    </div>
  );
}

function titleCase(plan: string): string {
  return plan.charAt(0) + plan.slice(1).toLowerCase();
}
