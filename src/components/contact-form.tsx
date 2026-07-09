"use client";

import { useState } from "react";
import { Send } from "lucide-react";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, subject, message, website }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Something went wrong");
      setState("error");
      return;
    }
    setState("sent");
    setName("");
    setEmail("");
    setSubject("");
    setMessage("");
  }

  const input =
    "mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent";

  if (state === "sent") {
    return (
      <div className="card p-6 text-center">
        <p className="font-semibold text-accent">Thanks — your message is on its way.</p>
        <p className="mt-1 text-sm text-muted">We&rsquo;ll get back to you at the email you provided.</p>
        <button
          type="button"
          onClick={() => setState("idle")}
          className="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-muted"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-4 p-6">
      {/* honeypot, visually hidden */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="hidden"
        aria-hidden
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Name</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={input} />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-medium">Subject <span className="text-muted">(optional)</span></span>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} className={input} />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Message</span>
        <textarea required rows={5} value={message} onChange={(e) => setMessage(e.target.value)} className={input} />
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={state === "sending"}
        className="inline-flex items-center justify-center gap-2 self-start rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
      >
        <Send className="h-4 w-4" />
        {state === "sending" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
