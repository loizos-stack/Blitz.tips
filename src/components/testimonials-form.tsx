"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Quote, Trash2 } from "lucide-react";

interface Testimonial {
  id: string;
  author: string;
  quote: string;
}

export function TestimonialsForm({ initial }: { initial: Testimonial[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Testimonial[]>(initial);
  const [author, setAuthor] = useState("");
  const [quote, setQuote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/handicapper/testimonials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author, quote }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Could not add testimonial");
      return;
    }
    setItems((prev) => [...prev, body.testimonial]);
    setAuthor("");
    setQuote("");
    router.refresh();
  }

  async function remove(id: string) {
    setItems((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/handicapper/testimonials?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="card p-5">
      <p className="flex items-center gap-2 font-semibold">
        <Quote className="h-4 w-4 text-accent" /> Testimonials
      </p>
      <p className="mt-1 text-xs text-muted">
        Add short quotes from your subscribers. They appear on your public profile. Only add feedback you
        have permission to share.
      </p>

      {items.length > 0 && (
        <ul className="mt-4 space-y-2">
          {items.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="text-sm text-muted">&ldquo;{t.quote}&rdquo;</p>
                <p className="mt-1 text-xs font-medium">— {t.author}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(t.id)}
                aria-label="Delete testimonial"
                className="shrink-0 rounded-lg border border-border p-1.5 text-muted hover:text-danger"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 space-y-2">
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Subscriber name (e.g. Mike D.)"
          maxLength={80}
          className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <textarea
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          placeholder="What they said about your picks…"
          rows={3}
          maxLength={600}
          className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={add}
          disabled={busy || !author.trim() || !quote.trim()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Adding…" : "Add testimonial"}
        </button>
        {error && <span className="text-sm text-danger">{error}</span>}
      </div>
    </div>
  );
}
