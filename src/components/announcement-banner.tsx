"use client";

import { useState } from "react";
import { X } from "lucide-react";

// Site-wide announcement set from the admin panel. The message is read on the
// server (cached) and passed in as `initialMessage`, so the banner is part of
// the initial HTML and never shifts the page in after load. Dismissal lasts for
// the browser session (per message, so a new announcement shows again).
export function AnnouncementBanner({ initialMessage = null }: { initialMessage?: string | null }) {
  const [message, setMessage] = useState<string | null>(initialMessage);

  // The banner lives in the root layout, so it doesn't remount on client-side
  // navigation — dismissing it hides it for the rest of the session.
  if (!message) return null;

  return (
    <div className="flex items-center justify-center gap-3 bg-accent px-4 py-2 text-center text-sm font-medium text-accent-foreground">
      <span>{message}</span>
      <button
        type="button"
        aria-label="Dismiss announcement"
        onClick={() => setMessage(null)}
        className="shrink-0 rounded p-0.5 hover:bg-black/10"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
