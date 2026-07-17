"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Send, Trash2, CheckCircle2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

type Author = "CUSTOMER" | "ADMIN";
type Status = "OPEN" | "CLOSED";

interface TicketMessage {
  id: string;
  author: Author;
  body: string;
  createdAt: string;
}
interface Ticket {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  status: Status;
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
}

function ref(id: string) {
  return id.slice(-8).toUpperCase();
}
function when(iso: string) {
  return new Date(iso).toLocaleString();
}

// How often to reload tickets so new customer replies (threaded in from inbound
// email) surface without a manual refresh.
const REFRESH_MS = 15_000;

export function TicketsManager({ initialTickets }: { initialTickets: Ticket[] }) {
  const router = useRouter();
  // Render straight from the server data so router.refresh() updates the list.
  const tickets = initialTickets;
  const [selectedId, setSelectedId] = useState<string | null>(initialTickets[0]?.id ?? null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-refresh so replies appear on their own. Your reply draft and which
  // ticket is selected are client state, so they survive the refresh.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(id);
  }, [router]);

  const selected = tickets.find((t) => t.id === selectedId) ?? null;

  async function call(id: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/tickets/${id}`, init);
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong");
      return false;
    }
    return true;
  }

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    const ok = await call(selected.id, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reply", body: reply }),
    });
    if (ok) {
      setReply("");
      router.refresh();
    }
  }

  async function setStatus(action: "close" | "reopen") {
    if (!selected) return;
    const ok = await call(selected.id, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (ok) router.refresh();
  }

  async function remove() {
    if (!selected) return;
    if (!confirm(`Delete ticket #${ref(selected.id)} from ${selected.email}? This can't be undone.`)) return;
    const ok = await call(selected.id, { method: "DELETE" });
    if (ok) {
      setSelectedId(null);
      router.refresh();
    }
  }

  if (tickets.length === 0) {
    return (
      <div className="card p-10 text-center text-muted">
        <Mail className="mx-auto mb-3 h-6 w-6" />
        No support tickets yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
      {/* Ticket list */}
      <div className="card max-h-[70vh] overflow-y-auto p-0">
        <ul className="divide-y divide-border">
          {tickets.map((t) => {
            return (
              <li key={t.id}>
                <button
                  onClick={() => setSelectedId(t.id)}
                  className={cn(
                    "w-full px-4 py-3 text-left transition-colors hover:bg-surface-raised",
                    selectedId === t.id && "bg-surface-raised"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{t.name}</span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        t.status === "OPEN" ? "bg-accent/15 text-accent" : "bg-surface-raised text-muted"
                      )}
                    >
                      {t.status}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted">{t.subject || "(no subject)"}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted">
                    #{ref(t.id)} · {when(t.updatedAt)}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Thread */}
      {selected ? (
        <div className="card flex flex-col p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <div className="min-w-0">
              <p className="font-semibold">
                {selected.subject || "(no subject)"}{" "}
                <span className="text-xs font-normal text-muted">#{ref(selected.id)}</span>
              </p>
              <p className="text-sm text-muted">
                {selected.name} ·{" "}
                <a href={`mailto:${selected.email}`} className="text-accent hover:underline">
                  {selected.email}
                </a>
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              {selected.status === "OPEN" ? (
                <button
                  onClick={() => setStatus("close")}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:border-muted disabled:opacity-60"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Close
                </button>
              ) : (
                <button
                  onClick={() => setStatus("reopen")}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:border-muted disabled:opacity-60"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reopen
                </button>
              )}
              <button
                onClick={remove}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          </div>

          <div className="flex max-h-[46vh] flex-col gap-3 overflow-y-auto p-4">
            {selected.messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "max-w-[85%] rounded-lg border px-3 py-2 text-sm",
                  m.author === "ADMIN"
                    ? "self-end border-accent/30 bg-accent/10"
                    : "self-start border-border bg-surface-raised"
                )}
              >
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                  {m.author === "ADMIN" ? "Blitz.tips" : selected.name} · {when(m.createdAt)}
                </p>
                <p className="whitespace-pre-wrap">{m.body}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-border p-4">
            <textarea
              rows={3}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Write a reply — it emails the customer and keeps the thread here."
              className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
            />
            {error && <p className="mt-1 text-sm text-danger">{error}</p>}
            <button
              onClick={sendReply}
              disabled={busy || !reply.trim()}
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
            >
              <Send className="h-4 w-4" /> {busy ? "Sending…" : "Send reply"}
            </button>
          </div>
        </div>
      ) : (
        <div className="card flex items-center justify-center p-10 text-muted">
          Select a ticket to view the conversation.
        </div>
      )}
    </div>
  );
}
