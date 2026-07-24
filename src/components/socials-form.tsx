"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Share2 } from "lucide-react";
import { SOCIAL_PLATFORMS, type SocialField } from "@/lib/socials";
import { SocialIcon } from "@/components/social-icon";

type Values = Record<SocialField, string>;

export function SocialsForm({ initial }: { initial: Partial<Record<SocialField, string | null>> }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(() => {
    const v = {} as Values;
    for (const p of SOCIAL_PLATFORMS) v[p.field] = initial[p.field] ?? "";
    return v;
  });
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setState("saving");
    setError(null);
    const res = await fetch("/api/handicapper/socials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Could not save your links");
      setState("error");
      return;
    }
    setState("saved");
    router.refresh();
  }

  return (
    <div className="card p-5">
      <p className="flex items-center gap-2 font-semibold">
        <Share2 className="h-4 w-4 text-accent" /> Social links
      </p>
      <p className="mt-1 text-xs text-muted">
        Add your channels — they show as icons on your public profile and cards. Leave any blank to hide it.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {SOCIAL_PLATFORMS.map((p) => (
          <label key={p.key} className="block">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <SocialIcon platform={p.key} className="h-3.5 w-3.5" /> {p.label}
            </span>
            <input
              type="url"
              inputMode="url"
              value={values[p.field]}
              onChange={(e) => {
                setValues((v) => ({ ...v, [p.field]: e.target.value }));
                setState("idle");
              }}
              placeholder={p.placeholder}
              className="mt-1 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </label>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={state === "saving"}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          {state === "saving" ? "Saving…" : "Save links"}
        </button>
        {state === "saved" && <span className="text-sm font-medium text-accent">Saved ✓</span>}
        {error && <span className="text-sm text-danger">{error}</span>}
      </div>
    </div>
  );
}
