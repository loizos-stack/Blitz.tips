"use client";

import { useState } from "react";
import { Copy, Check, Share2 } from "lucide-react";

// Small "share this" row: post to X (prewritten text + link) plus copy-link.
// Used on the public leaderboard and reusable anywhere a shareable URL exists.
export function ShareButtons({ url, text }: { url: string; text: string }) {
  const [copied, setCopied] = useState(false);
  // Tag the shared URL so X treats it as its own link (forces a fresh crawl of
  // our OG card instead of serving a stale "no preview" cache) and we get the
  // referral attribution. The copied link stays clean/canonical.
  const shareUrl = `${url}${url.includes("?") ? "&" : "?"}utm_source=twitter`;
  const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;

  return (
    <div className="flex items-center gap-2">
      <a
        href={intent}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground hover:opacity-90"
      >
        <Share2 className="h-4 w-4" /> Share on X
      </a>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard blocked — no-op */
          }
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-muted"
      >
        {copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
