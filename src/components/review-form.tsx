"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

const MAX_BODY = 1000;

const STATUS_NOTE: Record<ReviewStatus, { label: string; className: string }> = {
  PENDING: { label: "Pending review — awaiting approval before it appears publicly.", className: "text-gold" },
  APPROVED: { label: "Approved — live on the public profile.", className: "text-accent" },
  REJECTED: { label: "Not approved — it won't appear publicly. You can edit and resubmit.", className: "text-danger" },
};

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          className="rounded p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Star className={cn("h-7 w-7", n <= active ? "fill-gold text-gold" : "text-border")} />
        </button>
      ))}
    </div>
  );
}

export function ReviewForm({
  handicapperId,
  initial,
}: {
  handicapperId: string;
  initial: { rating: number; body: string | null; status: ReviewStatus } | null;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [body, setBody] = useState(initial?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit() {
    if (rating < 1) {
      setError("Pick a rating first");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handicapperId, rating, body }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save your review");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/reviews?handicapperId=${encodeURIComponent(handicapperId)}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (res.ok) {
      setRating(0);
      setBody("");
      setSaved(false);
      router.refresh();
    }
  }

  const note = initial ? STATUS_NOTE[initial.status] : null;

  return (
    <div>
      <StarPicker value={rating} onChange={setRating} />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Share how the picks have worked out for you (optional)…"
        rows={3}
        maxLength={MAX_BODY}
        className="mt-3 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || rating < 1}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Saving…" : initial ? "Update review" : "Post review"}
        </button>
        {initial && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="text-sm text-muted hover:text-danger disabled:opacity-60"
          >
            Remove
          </button>
        )}
        {saved && <span className="text-sm text-accent">Saved — pending moderation.</span>}
        {error && <span className="text-sm text-danger">{error}</span>}
      </div>
      {note && !saved && <p className={cn("mt-2 text-xs", note.className)}>{note.label}</p>}
    </div>
  );
}
