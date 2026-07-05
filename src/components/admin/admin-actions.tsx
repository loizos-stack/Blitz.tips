"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Generic row controls for the admin tables: a select that PATCHes a single
 * field, and a button for one-off PATCH/DELETE actions. Both refresh the
 * server-rendered table after a successful call.
 */

export function AdminSelect({
  endpoint,
  field,
  value,
  options,
}: {
  endpoint: string;
  field: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  return (
    <select
      value={value}
      disabled={busy}
      onChange={async (e) => {
        setBusy(true);
        setError(false);
        const res = await fetch(endpoint, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: e.target.value }),
        });
        setBusy(false);
        if (!res.ok) setError(true);
        router.refresh();
      }}
      className={`cursor-pointer rounded-lg border bg-surface px-2 py-1 text-xs font-medium outline-none disabled:opacity-50 ${
        error ? "border-danger" : "border-border hover:border-muted"
      }`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function AdminButton({
  endpoint,
  method = "PATCH",
  body,
  label,
  confirmText,
  tone = "default",
}: {
  endpoint: string;
  method?: "PATCH" | "DELETE" | "POST";
  body?: Record<string, unknown>;
  label: string;
  confirmText?: string;
  tone?: "default" | "danger";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (confirmText && !window.confirm(confirmText)) return;
        setBusy(true);
        const res = await fetch(endpoint, {
          method,
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
          const resBody = await res.json().catch(() => ({}));
          window.alert(resBody.error ?? "Action failed");
        }
        setBusy(false);
        router.refresh();
      }}
      className={`rounded-lg border px-2 py-1 text-xs font-medium disabled:opacity-50 ${
        tone === "danger"
          ? "border-danger/40 text-danger hover:bg-danger/10"
          : "border-border text-muted hover:text-foreground"
      }`}
    >
      {busy ? "…" : label}
    </button>
  );
}
