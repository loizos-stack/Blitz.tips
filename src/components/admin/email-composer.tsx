"use client";

import { useRef, useState } from "react";
import { Bold, Italic, Underline, List, Link2, Send } from "lucide-react";
import { cn } from "@/lib/utils";

const AUDIENCES = [
  { value: "ALL", label: "Everyone" },
  { value: "HANDICAPPERS", label: "Handicappers only" },
  { value: "CUSTOMERS", label: "Customers only" },
] as const;

type Audience = (typeof AUDIENCES)[number]["value"];

export function EmailComposer({
  counts,
}: {
  counts: { ALL: number; HANDICAPPERS: number; CUSTOMERS: number };
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [audience, setAudience] = useState<Audience>("ALL");
  const [subject, setSubject] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [result, setResult] = useState<string | null>(null);

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
    if (
      !window.confirm(
        `Send this email to ${counts[audience]} recipient${counts[audience] === 1 ? "" : "s"} (${AUDIENCES.find((a) => a.value === audience)?.label})?`
      )
    ) {
      return;
    }

    setState("sending");
    setResult(null);
    const res = await fetch("/api/admin/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience, subject, html }),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setState("error");
      setResult(body.error ?? "Sending failed");
      return;
    }
    setState("done");
    setResult(`Sent to ${body.sent} recipient${body.sent === 1 ? "" : "s"}${body.failed ? `, ${body.failed} failed` : ""}.`);
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
      </div>

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
    </div>
  );
}
