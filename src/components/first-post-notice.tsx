"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";

// One-time confirmation shown before a handicapper's very first tip/parlay post.
// They must tick "I understand" to proceed, because posting instantly notifies
// their followers and subscribers.
export function FirstPostNotice({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [checked, setChecked] = useState(false);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-post-title"
    >
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center gap-2 text-danger">
          <AlertTriangle className="h-5 w-5" />
          <h2 id="first-post-title" className="text-lg font-bold">
            Before you post
          </h2>
        </div>

        <p className="mt-3 text-sm text-muted">
          Please double-check everything before posting and make sure you have it right — your
          followers and subscribers are notified <span className="font-semibold text-foreground">instantly</span>{" "}
          the moment you press the button to post that tip or parlay.
        </p>

        <label className="mt-5 flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-surface-raised p-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="h-4 w-4"
          />
          I understand
        </label>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!checked}
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-accent py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
