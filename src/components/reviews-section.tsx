"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Stars } from "@/components/stars";
import { cn } from "@/lib/utils";

export interface ReviewItem {
  id: string;
  rating: number;
  body: string | null;
  createdAt: string;
  authorName: string;
  authorAvatarUrl: string | null;
  isOwn: boolean;
}

interface Props {
  handicapperId: string;
  displayName: string;
  average: number | null;
  count: number;
  reviews: ReviewItem[];
  canReview: boolean;
  myReview: { rating: number; body: string | null } | null;
}

const MAX_BODY = 1000;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Interactive 1–5 star picker for the review form.
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

export function ReviewsSection({
  handicapperId,
  displayName,
  average,
  count,
  reviews,
  canReview,
  myReview,
}: Props) {
  const router = useRouter();
  const [rating, setRating] = useState(myReview?.rating ?? 0);
  const [body, setBody] = useState(myReview?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (rating < 1) {
      setError("Pick a rating first");
      return;
    }
    setBusy(true);
    setError(null);
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
      router.refresh();
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold">Reviews</h2>
        {average !== null ? (
          <span className="flex items-center gap-2 text-sm text-muted">
            <Stars value={average} />
            <span className="font-semibold text-foreground">{average.toFixed(1)}</span>
            <span>
              ({count} review{count === 1 ? "" : "s"})
            </span>
          </span>
        ) : (
          <span className="text-sm text-muted">No reviews yet</span>
        )}
      </div>

      {canReview && (
        <div className="card mb-6 p-5">
          <p className="font-semibold">{myReview ? "Your review" : `Review ${displayName}`}</p>
          <p className="mt-1 text-xs text-muted">
            You can review because you subscribe (or have subscribed) to one of {displayName}&rsquo;s paid
            packages.
          </p>
          <div className="mt-3">
            <StarPicker value={rating} onChange={setRating} />
          </div>
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
              {busy ? "Saving…" : myReview ? "Update review" : "Post review"}
            </button>
            {myReview && (
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="text-sm text-muted hover:text-danger disabled:opacity-60"
              >
                Remove
              </button>
            )}
            {error && <span className="text-sm text-danger">{error}</span>}
          </div>
        </div>
      )}

      {reviews.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {reviews.map((r) => (
            <figure key={r.id} className={cn("card p-5", r.isOwn && "border-accent/40")}>
              <div className="flex items-center gap-3">
                <Avatar src={r.authorAvatarUrl} name={r.authorName} className="h-9 w-9 rounded-full text-xs" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {r.authorName}
                    {r.isOwn && <span className="ml-1.5 text-xs text-accent">(you)</span>}
                  </p>
                  <p className="text-xs text-muted">{formatDate(r.createdAt)}</p>
                </div>
              </div>
              <div className="mt-3">
                <Stars value={r.rating} />
              </div>
              {r.body && <blockquote className="mt-2 text-sm text-muted">{r.body}</blockquote>}
            </figure>
          ))}
        </div>
      ) : (
        !canReview && (
          <p className="text-sm text-muted">
            No reviews yet. Only paid subscribers can review {displayName}.
          </p>
        )
      )}
    </>
  );
}
