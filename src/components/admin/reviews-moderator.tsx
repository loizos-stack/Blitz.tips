"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Star, Check, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "PENDING" | "APPROVED" | "REJECTED";

interface Review {
  id: string;
  rating: number;
  body: string | null;
  status: Status;
  createdAt: string;
  handicapperHandle: string;
  handicapperName: string;
  authorName: string;
  authorEmail: string;
}

const FILTERS: { key: Status | "ALL"; label: string }[] = [
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "ALL", label: "All" },
];

const STATUS_BADGE: Record<Status, string> = {
  PENDING: "bg-gold/15 text-gold",
  APPROVED: "bg-accent/10 text-accent",
  REJECTED: "bg-danger/10 text-danger",
};

// Keep the queue fresh so newly submitted reviews surface without a manual reload.
const REFRESH_MS = 20_000;

function ReviewStars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("h-4 w-4", n <= rating ? "fill-yellow-400 text-yellow-400" : "text-border")} />
      ))}
    </span>
  );
}

export function ReviewsModerator({ initialReviews }: { initialReviews: Review[] }) {
  const router = useRouter();
  const reviews = initialReviews;
  const [filter, setFilter] = useState<Status | "ALL">("PENDING");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(id);
  }, [router]);

  const pendingCount = reviews.filter((r) => r.status === "PENDING").length;
  const shown = filter === "ALL" ? reviews : reviews.filter((r) => r.status === filter);

  async function moderate(id: string, action: "approve" | "reject") {
    setBusyId(id);
    setError(null);
    const res = await fetch("/api/admin/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    setBusyId(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "Something went wrong");
      return;
    }
    router.refresh();
  }

  async function remove(id: string) {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/admin/reviews?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setBusyId(null);
    if (res.ok) router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium",
              filter === f.key
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-muted hover:text-foreground"
            )}
          >
            {f.label}
            {f.key === "PENDING" && pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-gold px-1.5 text-xs font-semibold text-white">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      {shown.length === 0 ? (
        <p className="card p-8 text-center text-muted">No {filter === "ALL" ? "" : filter.toLowerCase()} reviews.</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => (
            <li key={r.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <ReviewStars rating={r.rating} />
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", STATUS_BADGE[r.status])}>
                      {r.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm">
                    <span className="font-medium">{r.authorName}</span>{" "}
                    <span className="text-muted">({r.authorEmail})</span> on{" "}
                    <Link href={`/handicappers/${r.handicapperHandle}`} className="text-accent hover:underline">
                      {r.handicapperName}
                    </Link>
                  </p>
                  <p className="text-xs text-muted">{new Date(r.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {r.status !== "APPROVED" && (
                    <button
                      onClick={() => moderate(r.id, "approve")}
                      disabled={busyId === r.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
                    >
                      <Check className="h-4 w-4" /> Approve
                    </button>
                  )}
                  {r.status !== "REJECTED" && (
                    <button
                      onClick={() => moderate(r.id, "reject")}
                      disabled={busyId === r.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted hover:text-danger disabled:opacity-60"
                    >
                      <X className="h-4 w-4" /> Reject
                    </button>
                  )}
                  <button
                    onClick={() => remove(r.id)}
                    disabled={busyId === r.id}
                    aria-label="Delete review"
                    className="rounded-lg border border-border p-1.5 text-muted hover:text-danger disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {r.body && (
                <blockquote className="mt-3 rounded-lg bg-surface-raised p-3 text-sm text-foreground">
                  {r.body}
                </blockquote>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
