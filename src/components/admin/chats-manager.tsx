"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Send, Trash2, CheckCircle2, RotateCcw, Hand } from "lucide-react";
import { cn } from "@/lib/utils";

type Author = "VISITOR" | "BOT" | "AGENT" | "SYSTEM";
type Status = "BOT" | "WAITING" | "LIVE" | "CLOSED";

interface Msg {
  id: string;
  author: Author;
  body: string;
  createdAt: string;
}
interface Chat {
  id: string;
  visitorName: string | null;
  visitorEmail: string | null;
  status: Status;
  createdAt: string;
  updatedAt: string;
  messages: Msg[];
}

const HEARTBEAT_MS = 20_000;
const POLL_MS = 4000;

function ref(id: string) {
  return id.slice(-6).toUpperCase();
}
function when(iso: string) {
  return new Date(iso).toLocaleString();
}

const STATUS_STYLES: Record<Status, string> = {
  WAITING: "bg-danger/15 text-danger",
  LIVE: "bg-accent/15 text-accent",
  BOT: "bg-surface-raised text-muted",
  CLOSED: "bg-surface-raised text-muted",
};

export function ChatsManager({ initialChats, onlineAgents }: { initialChats: Chat[]; onlineAgents: number }) {
  const router = useRouter();
  const [chats, setChats] = useState<Chat[]>(initialChats);
  const [selectedId, setSelectedId] = useState<string | null>(initialChats[0]?.id ?? null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = chats.find((c) => c.id === selectedId) ?? null;
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Presence heartbeat: while this tab is open the agent counts as online, so
  // visitors are offered live chat. Best-effort offline signal on unmount.
  useEffect(() => {
    const beat = () => void fetch("/api/admin/presence", { method: "POST" }).catch(() => {});
    beat();
    const handle = setInterval(beat, HEARTBEAT_MS);
    return () => {
      clearInterval(handle);
      void fetch("/api/admin/presence", { method: "DELETE", keepalive: true }).catch(() => {});
    };
  }, []);

  // Live-poll the selected chat for new visitor messages.
  const mergeInto = useCallback((chatId: string, status: Status, incoming: Msg[]) => {
    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== chatId) return c;
        const map = new Map(c.messages.map((m) => [m.id, m]));
        for (const m of incoming) map.set(m.id, m);
        const messages = [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        return { ...c, status, messages };
      })
    );
  }, []);

  useEffect(() => {
    if (!selected) return;
    const id = selected.id;
    let active = true;
    const tick = async () => {
      try {
        const last = selected.messages[selected.messages.length - 1]?.createdAt;
        const params = new URLSearchParams();
        if (last) params.set("after", last);
        const res = await fetch(`/api/admin/chats/${id}?${params.toString()}`);
        if (!res.ok || !active) return;
        const data = await res.json();
        mergeInto(id, data.status as Status, (data.messages ?? []) as Msg[]);
      } catch {
        /* transient */
      }
    };
    const handle = setInterval(tick, POLL_MS);
    return () => {
      active = false;
      clearInterval(handle);
    };
    // Re-arm when the selection or its latest message changes.
  }, [selectedId, selected?.messages.length, mergeInto]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [selected?.messages.length, selectedId]);

  async function call(id: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/chats/${id}`, init);
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

  async function act(action: "claim" | "close" | "reopen") {
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
    if (!confirm(`Delete chat #${ref(selected.id)}? This can't be undone.`)) return;
    const ok = await call(selected.id, { method: "DELETE" });
    if (ok) {
      setSelectedId(null);
      setChats((prev) => prev.filter((c) => c.id !== selected.id));
      router.refresh();
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted">
        <span className={cn("h-2 w-2 rounded-full", "bg-accent")} />
        You&rsquo;re marked online while this tab is open{onlineAgents > 1 ? ` · ${onlineAgents} agents online` : ""}.
      </div>

      {chats.length === 0 ? (
        <div className="card p-10 text-center text-muted">
          <MessageSquare className="mx-auto mb-3 h-6 w-6" />
          No visitor chats yet.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
          {/* Chat list */}
          <div className="card max-h-[70vh] overflow-y-auto p-0">
            <ul className="divide-y divide-border">
              {chats.map((c) => {
                const preview = c.messages[c.messages.length - 1]?.body ?? "";
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        "w-full px-4 py-3 text-left transition-colors hover:bg-surface-raised",
                        selectedId === c.id && "bg-surface-raised"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{c.visitorName || `Visitor #${ref(c.id)}`}</span>
                        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", STATUS_STYLES[c.status])}>
                          {c.status}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted">{preview || "(no messages)"}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted">#{ref(c.id)} · {when(c.updatedAt)}</p>
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
                    {selected.visitorName || `Visitor #${ref(selected.id)}`}{" "}
                    <span className={cn("ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", STATUS_STYLES[selected.status])}>
                      {selected.status}
                    </span>
                  </p>
                  <p className="text-sm text-muted">
                    {selected.visitorEmail ? (
                      <a href={`mailto:${selected.visitorEmail}`} className="text-accent hover:underline">
                        {selected.visitorEmail}
                      </a>
                    ) : (
                      "Anonymous visitor"
                    )}{" "}
                    · started {when(selected.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {selected.status !== "LIVE" && selected.status !== "CLOSED" && (
                    <button
                      onClick={() => act("claim")}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-60"
                    >
                      <Hand className="h-3.5 w-3.5" /> Claim
                    </button>
                  )}
                  {selected.status === "CLOSED" ? (
                    <button
                      onClick={() => act("reopen")}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:border-muted disabled:opacity-60"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Reopen
                    </button>
                  ) : (
                    <button
                      onClick={() => act("close")}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:border-muted disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Close
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

              <div ref={scrollRef} className="flex max-h-[46vh] flex-col gap-2 overflow-y-auto p-4">
                {selected.messages.map((m) =>
                  m.author === "SYSTEM" ? (
                    <p key={m.id} className="mx-auto max-w-[90%] rounded-full bg-surface-raised px-3 py-1 text-center text-[11px] text-muted">
                      {m.body}
                    </p>
                  ) : (
                    <div
                      key={m.id}
                      className={cn(
                        "max-w-[85%] rounded-lg border px-3 py-2 text-sm",
                        m.author === "VISITOR"
                          ? "self-start border-border bg-surface-raised"
                          : "self-end border-accent/30 bg-accent/10"
                      )}
                    >
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                        {m.author === "VISITOR"
                          ? selected.visitorName || "Visitor"
                          : m.author === "BOT"
                            ? "Assistant (bot)"
                            : "You"}{" "}
                        · {when(m.createdAt)}
                      </p>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                    </div>
                  )
                )}
              </div>

              <div className="border-t border-border p-4">
                <textarea
                  rows={3}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      sendReply();
                    }
                  }}
                  placeholder="Reply to the visitor — this takes over the chat from the bot."
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
            <div className="card flex items-center justify-center p-10 text-muted">Select a chat to view the conversation.</div>
          )}
        </div>
      )}
    </div>
  );
}
