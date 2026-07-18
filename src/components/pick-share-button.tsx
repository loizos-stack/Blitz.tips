"use client";

import { Share2, Download } from "lucide-react";

// Compact per-pick share controls shown on a handicapper's public picks: post to
// X (prewritten, links back to the profile) and download the branded pick card.
// The card image (imageUrl) is rendered server-side and already hides the play
// for a still-locked premium pick, so this is safe on every pick.
export function PickShareButton({
  text,
  url,
  imageUrl,
  downloadName,
}: {
  text: string;
  url: string;
  imageUrl: string;
  downloadName: string;
}) {
  // utm so X re-crawls the card fresh instead of a stale "no preview" cache.
  const shareUrl = `${url}${url.includes("?") ? "&" : "?"}utm_source=twitter`;
  const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;

  return (
    <div className="flex items-center gap-1">
      <a
        href={intent}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on X"
        title="Share on X"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted hover:border-accent hover:text-accent"
      >
        <Share2 className="h-4 w-4" />
      </a>
      <a
        href={imageUrl}
        download={downloadName}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Download share card"
        title="Download share card"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted hover:border-accent hover:text-accent"
      >
        <Download className="h-4 w-4" />
      </a>
    </div>
  );
}
