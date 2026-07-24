"use client";

import { useState } from "react";
import { Copy, Check, Download } from "lucide-react";

// Compact per-pick share controls (dashboard only). Post to several networks,
// copy the link, or download the branded card. The card image (imageUrl) is
// rendered server-side and already hides the play for a still-locked premium
// pick, so this is safe on every pick.

// lucide-react dropped brand marks, so the social logos are inlined as SVG.
function BrandIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d={path} />
    </svg>
  );
}

const PATHS = {
  x: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  facebook:
    "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
  whatsapp:
    "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488",
  telegram:
    "M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z",
  reddit:
    "M24 11.779c0-1.459-1.192-2.645-2.657-2.645-.715 0-1.363.286-1.84.746-1.81-1.191-4.259-1.949-6.971-2.046l1.483-4.669 4.016.941-.006.058c0 1.193.975 2.163 2.174 2.163 1.198 0 2.172-.97 2.172-2.163s-.975-2.164-2.172-2.164c-.92 0-1.703.574-2.021 1.379l-4.329-1.015c-.189-.046-.381.063-.44.249l-1.654 5.207c-2.762.076-5.256.83-7.098 2.032-.475-.461-1.124-.746-1.84-.746C1.192 9.134 0 10.32 0 11.779c0 .952.516 1.789 1.281 2.252-.037.212-.055.428-.055.646 0 3.267 3.797 5.924 8.464 5.924s8.464-2.657 8.464-5.924c0-.215-.019-.428-.055-.638.769-.462 1.286-1.301 1.286-2.252zm-17.42 1.982c0-.834.679-1.513 1.513-1.513.834 0 1.513.679 1.513 1.513s-.679 1.513-1.513 1.513c-.834 0-1.513-.679-1.513-1.513zm7.816 4.005c-.958.958-2.786 1.032-3.323 1.032-.537 0-2.365-.074-3.323-1.032a.363.363 0 010-.515.363.363 0 01.515 0c.604.604 1.897.818 2.808.818.911 0 2.204-.214 2.808-.818a.363.363 0 01.515 0 .363.363 0 010 .515zm-.293-2.492c-.834 0-1.513-.679-1.513-1.513s.679-1.513 1.513-1.513c.834 0 1.513.679 1.513 1.513s-.679 1.513-1.513 1.513z",
};

function withUtm(url: string, source: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}utm_source=${source}`;
}

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
  const [copied, setCopied] = useState(false);

  const links: { label: string; href: string; path: string }[] = [
    {
      label: "Share on X",
      path: PATHS.x,
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(withUtm(url, "twitter"))}`,
    },
    {
      label: "Share on Facebook",
      path: PATHS.facebook,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(withUtm(url, "facebook"))}`,
    },
    {
      label: "Share on WhatsApp",
      path: PATHS.whatsapp,
      href: `https://api.whatsapp.com/send?text=${encodeURIComponent(`${text} ${withUtm(url, "whatsapp")}`)}`,
    },
    {
      label: "Share on Telegram",
      path: PATHS.telegram,
      href: `https://t.me/share/url?url=${encodeURIComponent(withUtm(url, "telegram"))}&text=${encodeURIComponent(text)}`,
    },
    {
      label: "Share on Reddit",
      path: PATHS.reddit,
      href: `https://www.reddit.com/submit?url=${encodeURIComponent(withUtm(url, "reddit"))}&title=${encodeURIComponent(text)}`,
    },
  ];

  const btn =
    "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted hover:border-accent hover:text-accent";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {links.map((l) => (
        <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" aria-label={l.label} title={l.label} className={btn}>
          <BrandIcon path={l.path} />
        </a>
      ))}
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
        aria-label="Copy link"
        title="Copy link"
        className={btn}
      >
        {copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
      </button>
      <a href={imageUrl} download={downloadName} target="_blank" rel="noopener noreferrer" aria-label="Download share card" title="Download share card" className={btn}>
        <Download className="h-4 w-4" />
      </a>
    </div>
  );
}
