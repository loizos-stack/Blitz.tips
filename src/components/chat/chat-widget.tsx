"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Headset, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Author = "VISITOR" | "BOT" | "AGENT" | "SYSTEM";
type Status = "BOT" | "WAITING" | "LIVE" | "CLOSED";

interface Msg {
  id: string;
  author: Author;
  body: string;
  createdAt: string;
}

const DISMISS_COOKIE = "blitz_chat_dismissed";
const DISMISS_DAYS = 3;
const ID_KEY = "blitz_chat_id";
const TOKEN_KEY = "blitz_chat_token";
const POLL_MS = 4000;

const GREETING: Msg = {
  id: "greeting",
  author: "BOT",
  body: "Hi! 👋 I'm the Blitz.tips assistant. Ask me about subscribing to handicappers, verified records, becoming a handicapper, payouts — or tap “Talk to a human” any time.",
  createdAt: new Date(0).toISOString(),
};

function hasDismissCookie(): boolean {
  return document.cookie.split("; ").some((c) => c.startsWith(`${DISMISS_COOKIE}=`));
}
function setDismissCookie() {
  const maxAge = DISMISS_DAYS * 24 * 60 * 60;
  document.cookie = `${DISMISS_COOKIE}=1; path=/; max-age=${maxAge}; samesite=lax`;
}

export function ChatWidget() {
  const [ready, setReady] = useState(false); // mounted + cookie checked
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [status, setStatus] = useState<Status>("BOT");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<"chat" | "form">("chat");

  const chatIdRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const lastAtRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Mount: honour the 3-day dismiss cookie and restore any existing chat id.
  // Refs are set synchronously; the state updates are deferred a tick to stay
  // clear of the set-state-in-effect lint rule.
  useEffect(() => {
    chatIdRef.current = localStorage.getItem(ID_KEY);
    tokenRef.current = localStorage.getItem(TOKEN_KEY);
    const dismissedNow = hasDismissCookie();
    const t = setTimeout(() => {
      setDismissed(dismissedNow);
      setReady(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const mergeMessages = useCallback((incoming: Msg[]) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const map = new Map(prev.filter((m) => m.id !== "greeting").map((m) => [m.id, m]));
      for (const m of incoming) map.set(m.id, m);
      const arr = [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      lastAtRef.current = arr[arr.length - 1]?.createdAt ?? lastAtRef.current;
      return arr;
    });
  }, []);

  // Poll for new messages/status while an escalated chat is open.
  useEffect(() => {
    if (!open || mode === "form") return;
    const id = chatIdRef.current;
    const token = tokenRef.current;
    if (!id || !token) return;

    let active = true;
    const tick = async () => {
      try {
        const params = new URLSearchParams({ chatId: id, token });
        if (lastAtRef.current) params.set("after", lastAtRef.current);
        const res = await fetch(`/api/chat?${params.toString()}`);
        if (!res.ok || !active) return;
        const data = await res.json();
        setStatus(data.status as Status);
        mergeMessages((data.messages ?? []) as Msg[]);
      } catch {
        /* transient network — try again next tick */
      }
    };
    const handle = setInterval(tick, POLL_MS);
    return () => {
      active = false;
      clearInterval(handle);
    };
  }, [open, mode, status, mergeMessages]);

  // Keep the transcript pinned to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, mode]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    // Optimistic echo.
    const optimistic: Msg = { id: `local-${Date.now()}`, author: "VISITOR", body: text, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev.filter((m) => m.id !== "greeting"), optimistic]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: chatIdRef.current, token: tokenRef.current, message: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        chatIdRef.current = data.chatId;
        tokenRef.current = data.token;
        localStorage.setItem(ID_KEY, data.chatId);
        localStorage.setItem(TOKEN_KEY, data.token);
        setStatus(data.status as Status);
        // Replace optimistic echo with the server copies (visitor + bot).
        setMessages((prev) => [...prev.filter((m) => m.id !== optimistic.id), ...((data.messages ?? []) as Msg[])]);
        const last = (data.messages ?? []) as Msg[];
        lastAtRef.current = last[last.length - 1]?.createdAt ?? lastAtRef.current;
      }
    } catch {
      /* leave the optimistic message; the visitor can retry */
    } finally {
      setSending(false);
    }
  }

  async function talkToHuman() {
    // No chat yet? Nudge them to say something first so an agent has context.
    if (!chatIdRef.current || !tokenRef.current) {
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== "greeting"),
        { id: `sys-${Date.now()}`, author: "SYSTEM", body: "Type your question first and I'll pass it to a human if one's available.", createdAt: new Date().toISOString() },
      ]);
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/chat/escalate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: chatIdRef.current, token: tokenRef.current }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.online) {
        setStatus("WAITING");
      } else {
        // No agent online → fall back to the contact form (opens a ticket).
        setMode("form");
      }
    } catch {
      setMode("form");
    } finally {
      setSending(false);
    }
  }

  function dismiss() {
    setDismissCookie();
    setDismissed(true);
    setOpen(false);
  }

  if (!ready || dismissed) return null;

  const statusLabel =
    status === "LIVE" ? "Chatting with our team" : status === "WAITING" ? "Waiting for an agent…" : "Assistant";

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <div className="flex h-[32rem] max-h-[calc(100vh-6rem)] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 bg-accent px-4 py-3 text-accent-foreground">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Blitz.tips</p>
              <p className="flex items-center gap-1.5 truncate text-xs opacity-90">
                <span className={cn("h-1.5 w-1.5 rounded-full", status === "LIVE" ? "bg-white" : "bg-white/70")} />
                {statusLabel}
              </p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Minimise chat" className="rounded-full p-1 hover:bg-white/20">
              <X className="h-4 w-4" />
            </button>
          </div>

          {mode === "form" ? (
            <WidgetContactForm onDone={() => setMode("chat")} />
          ) : (
            <>
              {/* Transcript */}
              <div ref={scrollRef} className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
                {messages.map((m) =>
                  m.author === "SYSTEM" ? (
                    <p key={m.id} className="mx-auto max-w-[90%] rounded-full bg-surface-raised px-3 py-1 text-center text-[11px] text-muted">
                      {m.body}
                    </p>
                  ) : (
                    <div
                      key={m.id}
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                        m.author === "VISITOR"
                          ? "self-end rounded-br-sm bg-accent text-accent-foreground"
                          : "self-start rounded-bl-sm bg-surface-raised text-foreground"
                      )}
                    >
                      {m.author === "AGENT" && (
                        <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-accent">Support</span>
                      )}
                      <span className="whitespace-pre-wrap">{m.body}</span>
                    </div>
                  )
                )}
                {sending && status === "BOT" && (
                  <div className="self-start rounded-2xl rounded-bl-sm bg-surface-raised px-3 py-2 text-muted">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                )}
              </div>

              {/* Talk to a human */}
              {status !== "WAITING" && (
                <div className="px-3">
                  <button
                    onClick={talkToHuman}
                    disabled={sending}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-1.5 text-xs font-medium text-muted hover:border-muted hover:text-foreground disabled:opacity-60"
                  >
                    <Headset className="h-3.5 w-3.5" /> Talk to a human
                  </button>
                </div>
              )}

              {/* Composer */}
              <div className="flex items-end gap-2 border-t border-border p-3">
                <textarea
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Type a message…"
                  className="max-h-24 flex-1 resize-none rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
                />
                <button
                  onClick={send}
                  disabled={sending || !input.trim()}
                  aria-label="Send"
                  className="rounded-lg bg-accent p-2 text-accent-foreground hover:opacity-90 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Launcher bubble with a dismiss (3-day) affordance */}
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close chat" : "Open chat"}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg transition-transform hover:scale-105"
        >
          {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        </button>
        {!open && (
          <button
            onClick={dismiss}
            aria-label="Dismiss chat for 3 days"
            title="Hide for 3 days"
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface text-muted shadow hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// Compact contact form shown when no agent is online — posts to /api/contact,
// which opens a support ticket and emails the visitor + team.
function WidgetContactForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject: "Chat (no agent available)", message, website }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Something went wrong");
        setState("error");
        return;
      }
      setState("sent");
    } catch {
      setError("Something went wrong");
      setState("error");
    }
  }

  const input = "w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent";

  if (state === "sent") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="font-semibold text-accent">Thanks — we&rsquo;ve opened a ticket.</p>
        <p className="text-sm text-muted">Our team will reply to your email as soon as possible.</p>
        <button onClick={onDone} className="mt-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-muted">
          Back to chat
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
      <p className="text-sm text-muted">
        No one&rsquo;s online right now. Leave your details and we&rsquo;ll open a support ticket and get back to you by email.
      </p>
      <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} className="hidden" aria-hidden />
      <input required placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} className={input} />
      <input type="email" required placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
      <textarea required rows={4} placeholder="How can we help?" value={message} onChange={(e) => setMessage(e.target.value)} className={input} />
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={state === "sending"}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          <Send className="h-4 w-4" /> {state === "sending" ? "Sending…" : "Send"}
        </button>
        <button type="button" onClick={onDone} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-muted">
          Back
        </button>
      </div>
    </form>
  );
}
