"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * The copy-paste snippets for a handicapper's verified-record badge.
 *
 * The badge is only worth building if it's trivial to place, so this hands over
 * the exact string for the three places a capper actually has: a website, a
 * forum or newsletter that only takes markdown, and a bio that only takes a
 * link.
 */
export function BadgeEmbed({ baseUrl, handle }: { baseUrl: string; handle: string }) {
  const src = `${baseUrl}/badge/${handle}.svg`;
  const profile = `${baseUrl}/handicappers/${handle}`;

  const snippets = [
    {
      label: "HTML — for a website",
      hint: "Links back to your profile, so the badge is clickable.",
      code: `<a href="${profile}"><img src="${src}" alt="Verified record on Blitz.tips" width="440" height="132"></a>`,
    },
    {
      label: "Markdown — for a newsletter or forum",
      hint: "Substack, Ghost, Reddit, most forums.",
      code: `[![Verified record on Blitz.tips](${src})](${profile})`,
    },
    {
      label: "Direct image link",
      hint: "Anywhere that takes a URL — a bio, a Discord embed, a pinned post.",
      code: src,
    },
  ];

  return (
    <div className="card p-5">
      <h2 className="font-semibold">Embed your verified record</h2>
      <p className="mt-1 text-sm text-muted">
        A live image of your record — it updates itself as picks settle, so it can never drift from
        the truth the way a screenshot does. Put it on your site, your newsletter, or anywhere that
        takes an image.
      </p>

      <div className="mt-4 overflow-x-auto">
        {/* eslint-disable-next-line @next/next/no-img-element -- our own SVG endpoint, deliberately not optimized */}
        <img src={src} alt="Your verified record badge" width={440} height={132} className="max-w-none" />
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {snippets.map((s) => (
          <Snippet key={s.label} {...s} />
        ))}
      </div>
    </div>
  );
}

function Snippet({ label, hint, code }: { label: string; hint: string; code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked (insecure origin, permissions). The code is
      // selectable on screen, so there's still a way through.
      setCopied(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-xs text-muted">{hint}</p>
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-accent hover:text-accent"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-raised p-3 font-mono text-[0.7rem] leading-relaxed">
        {code}
      </pre>
    </div>
  );
}
