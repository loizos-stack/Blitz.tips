"use client";

import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Underline, List, Link2, Send, X, Search, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const AUDIENCES = [
  { value: "ALL", label: "Everyone" },
  { value: "HANDICAPPERS", label: "Handicappers only" },
  { value: "CUSTOMERS", label: "Customers only" },
  { value: "CONTEST_ENTRANTS", label: "Contest entrants" },
] as const;

type Audience = (typeof AUDIENCES)[number]["value"] | "USER";

interface Person {
  id: string;
  email: string;
  name: string | null;
  handle: string | null;
  unsubscribed: boolean;
}

export function EmailComposer({
  counts,
}: {
  counts: { ALL: number; HANDICAPPERS: number; CUSTOMERS: number; CONTEST_ENTRANTS: number };
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [audience, setAudience] = useState<Audience>("ALL");
  const [subject, setSubject] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [result, setResult] = useState<string | null>(null);
  /** Who was dropped and why — a count alone sends you to the logs. */
  const [failures, setFailures] = useState<{ email: string; reason: string }[]>([]);

  // One-to-one: who it goes to, and the lookup that finds them.
  const [person, setPerson] = useState<Person | null>(null);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);

  // Debounced so typing an address isn't one request per keystroke. Everything
  // happens inside the timer, including clearing: a synchronous setState in an
  // effect body renders twice and the lint rule rightly objects.
  useEffect(() => {
    const q = query.trim();
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (audience !== "USER" || person || q.length < 3) {
        if (!cancelled) setMatches([]);
        return;
      }
      if (!cancelled) setSearching(true);
      try {
        const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(q)}`);
        const body = await res.json().catch(() => ({}));
        if (!cancelled) setMatches(Array.isArray(body.users) ? body.users : []);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, audience, person]);

  function exec(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  }

  async function send() {
    const html = editorRef.current?.innerHTML ?? "";
    const isEmpty = !editorRef.current?.textContent?.trim();
    if (!subject.trim() || isEmpty) {
      setResult("Add a subject and a message first.");
      setState("error");
      return;
    }
    if (audience === "USER" && !person) {
      setResult("Choose who this is going to first.");
      setState("error");
      return;
    }

    // Naming the single recipient's address in the prompt is the last chance to
    // notice it is the wrong person.
    const confirmText =
      audience === "USER"
        ? `Send this email to ${person!.email}?${person!.unsubscribed ? "\n\nThey have unsubscribed from announcements. A direct message still reaches them." : ""}`
        : `Send this email to ${counts[audience]} recipient${counts[audience] === 1 ? "" : "s"} (${AUDIENCES.find((a) => a.value === audience)?.label})?`;
    if (!window.confirm(confirmText)) return;

    setState("sending");
    setResult(null);
    const res = await fetch("/api/admin/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience, subject, html, userId: person?.id }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      sent?: number;
      failed?: number;
      error?: string;
      reasons?: string[];
      failedSample?: { email: string; reason: string }[];
    };

    if (!res.ok) {
      setState("error");
      setResult(body.error ?? "Sending failed");
      return;
    }
    setState(body.failed ? "error" : "done");
    setFailures(body.failedSample ?? []);
    setResult(
      audience === "USER"
        ? `Sent to ${person!.email}.`
        : `Sent to ${body.sent} recipient${body.sent === 1 ? "" : "s"}` +
          (body.failed
            ? `, ${body.failed} failed — ${(body.reasons ?? []).join("; ") || "no reason given"}`
            : ".")
    );
  }

  const toolBtn =
    "rounded p-1.5 text-muted hover:bg-surface-raised hover:text-foreground";

  return (
    <div className="card max-w-3xl p-6">
      <div className="flex flex-wrap gap-2">
        {AUDIENCES.map((a) => (
          <button
            key={a.value}
            type="button"
            onClick={() => setAudience(a.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium",
              audience === a.value
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-muted hover:text-foreground"
            )}
          >
            {a.label} · {counts[a.value]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAudience("USER")}
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm font-medium",
            audience === "USER"
              ? "border-accent bg-accent/10 text-accent"
              : "border-border text-muted hover:text-foreground"
          )}
        >
          One person
        </button>
      </div>

      {audience === "USER" && (
        <div className="mt-4">
          {person ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent bg-accent/5 px-3 py-2">
              <span className="text-sm font-medium">{person.email}</span>
              {(person.name || person.handle) && (
                <span className="text-xs text-muted">
                  {person.name}
                  {person.handle && ` · @${person.handle}`}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setPerson(null);
                  setQuery("");
                }}
                className="ml-auto inline-flex items-center gap-1 text-xs text-muted hover:text-danger"
              >
                <X className="h-3 w-3" /> Change
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find someone by email, name or @handle"
                className="w-full rounded-lg border border-border bg-surface-raised py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
              />
              {matches.length > 0 && (
                <ul className="mt-1 overflow-hidden rounded-lg border border-border">
                  {matches.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => setPerson(m)}
                        className="flex w-full flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-left text-sm last:border-b-0 hover:bg-surface-raised"
                      >
                        <span className="font-medium">{m.email}</span>
                        {(m.name || m.handle) && (
                          <span className="text-xs text-muted">
                            {m.name}
                            {m.handle && ` · @${m.handle}`}
                          </span>
                        )}
                        {m.unsubscribed && (
                          <span className="ml-auto rounded-full bg-muted/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted">
                            Unsubscribed
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!searching && query.trim().length >= 3 && matches.length === 0 && (
                <p className="mt-2 text-xs text-muted">Nobody matches that.</p>
              )}
            </div>
          )}
          {person?.unsubscribed && (
            <p className="mt-2 flex items-start gap-2 text-xs text-muted">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              They have unsubscribed from announcements. A message to one person still reaches them —
              opting out of a mailing list is not a request never to be replied to.
            </p>
          )}
          <p className="mt-2 text-xs text-muted">
            Sent as ordinary correspondence: no unsubscribe footer, because there is no list to leave.
          </p>
        </div>
      )}

      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Subject"
        className="mt-4 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm font-medium outline-none focus:border-accent"
      />

      <div className="mt-3 overflow-hidden rounded-lg border border-border">
        <div className="flex items-center gap-1 border-b border-border bg-surface-raised px-2 py-1.5">
          <button type="button" onClick={() => exec("bold")} className={toolBtn} aria-label="Bold">
            <Bold className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => exec("italic")} className={toolBtn} aria-label="Italic">
            <Italic className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => exec("underline")} className={toolBtn} aria-label="Underline">
            <Underline className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => exec("insertUnorderedList")}
            className={toolBtn}
            aria-label="Bullet list"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              const url = window.prompt("Link URL (https://…)");
              if (url) exec("createLink", url);
            }}
            className={toolBtn}
            aria-label="Insert link"
          >
            <Link2 className="h-4 w-4" />
          </button>
        </div>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Write your message…"
          className="min-h-48 px-4 py-3 text-sm leading-relaxed outline-none [&_a]:text-accent [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5"
        />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={send}
          disabled={state === "sending"}
          className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          <Send className="h-4 w-4" />
          {state === "sending" ? "Sending…" : "Send email"}
        </button>
        {result && (
          <p className={cn("text-sm", state === "error" ? "text-danger" : "text-accent")}>{result}</p>
        )}
      </div>

      {failures.length > 0 && (
        <div className="mt-3 rounded-lg border border-danger/30 bg-danger/5 p-3">
          <p className="text-xs font-semibold text-danger">Didn&apos;t go out</p>
          <ul className="mt-1.5 space-y-0.5 text-xs text-muted">
            {failures.map((f) => (
              <li key={f.email}>
                <span className="font-medium">{f.email}</span> — {f.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
