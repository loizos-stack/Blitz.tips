"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

// Site-wide announcement set from the admin panel. Fetched client-side so
// static pages stay static; dismissal lasts for the browser session (per
// message, so a new announcement shows again).
export function AnnouncementBanner() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/announcement")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        const msg = body?.message?.trim();
        if (msg && sessionStorage.getItem("dismissed-announcement") !== msg) {
          setMessage(msg);
        }
      })
      .catch(() => undefined);
  }, []);

  if (!message) return null;

  return (
    <div className="flex items-center justify-center gap-3 bg-accent px-4 py-2 text-center text-sm font-medium text-accent-foreground">
      <span>{message}</span>
      <button
        type="button"
        aria-label="Dismiss announcement"
        onClick={() => {
          sessionStorage.setItem("dismissed-announcement", message);
          setMessage(null);
        }}
        className="shrink-0 rounded p-0.5 hover:bg-black/10"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
