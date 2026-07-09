"use client";

import { useState } from "react";
import { ArrowUp, ArrowDown, GripVertical } from "lucide-react";
import type { DashboardKind, DashboardSection } from "@/lib/dashboard-sections";

interface DashboardPanelProps {
  kind: DashboardKind;
  title: string;
  description: string;
  sections: DashboardSection[];
  initialOrder: string[];
}

// One reorderable list per dashboard. Kept intentionally simple — up/down
// buttons rather than drag-and-drop — so it works without extra dependencies
// and stays keyboard-accessible.
function DashboardPanel({ kind, title, description, sections, initialOrder }: DashboardPanelProps) {
  const byKey = new Map(sections.map((s) => [s.key, s]));
  const [order, setOrder] = useState<string[]>(initialOrder);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  function move(index: number, delta: number) {
    const next = [...order];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    setState("idle");
  }

  async function save() {
    setState("saving");
    const res = await fetch("/api/admin/cms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, order }),
    });
    setState(res.ok ? "saved" : "error");
  }

  return (
    <div className="card p-5">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted">{description}</p>

      <ol className="mt-4 flex flex-col gap-2">
        {order.map((key, index) => {
          const section = byKey.get(key);
          if (!section) return null;
          return (
            <li
              key={key}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface-raised px-3 py-2.5"
            >
              <GripVertical className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{section.label}</span>
                <span className="block truncate text-xs text-muted">{section.description}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${section.label} up`}
                  className="rounded-md border border-border p-1.5 text-muted hover:text-foreground disabled:opacity-30"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === order.length - 1}
                  aria-label={`Move ${section.label} down`}
                  className="rounded-md border border-border p-1.5 text-muted hover:text-foreground disabled:opacity-30"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={state === "saving"}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          {state === "saving" ? "Saving…" : "Save order"}
        </button>
        {state === "saved" && <span className="text-sm font-medium text-accent">Saved ✓</span>}
        {state === "error" && <span className="text-sm text-danger">Save failed</span>}
      </div>
    </div>
  );
}

export interface CmsEditorProps {
  handicapper: { sections: DashboardSection[]; order: string[] };
  subscriber: { sections: DashboardSection[]; order: string[] };
  profile: { sections: DashboardSection[]; order: string[] };
}

export function CmsEditor({ handicapper, subscriber, profile }: CmsEditorProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <DashboardPanel
        kind="handicapper"
        title="Handicapper dashboard"
        description="Order of the sections below the profile header and Stripe banner."
        sections={handicapper.sections}
        initialOrder={handicapper.order}
      />
      <DashboardPanel
        kind="subscriber"
        title="Customer dashboard"
        description="Order of the sections below the feed heading."
        sections={subscriber.sections}
        initialOrder={subscriber.order}
      />
      <DashboardPanel
        kind="profile"
        title="Handicapper profile page"
        description="Order of the sections below the profile header and subscribe box (public page)."
        sections={profile.sections}
        initialOrder={profile.order}
      />
    </div>
  );
}
