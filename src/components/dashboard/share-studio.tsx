"use client";

import { useState } from "react";
import { Copy, Check, Download, Share2 } from "lucide-react";
import type { PickResult } from "@prisma/client";

export interface SharePick {
  id: string;
  matchup: string;
  selection: string;
  result: PickResult;
  sportLabel: string;
}

function xIntent(text: string, url: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
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
  );
}

function ShareActions({ text, url, imageUrl, download }: { text: string; url: string; imageUrl: string; download: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={xIntent(text, url)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground hover:opacity-90"
      >
        <Share2 className="h-4 w-4" /> Share to X
      </a>
      <CopyButton value={url} />
      <a
        href={imageUrl}
        download={download}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-muted"
      >
        <Download className="h-4 w-4" /> Download image
      </a>
    </div>
  );
}

export function ShareStudio({
  baseUrl,
  handle,
  displayName,
  record,
  unitsNet,
  roi,
  picks,
}: {
  baseUrl: string;
  handle: string;
  displayName: string;
  record: string;
  unitsNet: number;
  roi: number | null;
  picks: SharePick[];
}) {
  const profileUrl = `${baseUrl}/handicappers/${handle}`;
  const recordImageUrl = `${baseUrl}/handicappers/${handle}/opengraph-image`;
  const units = `${unitsNet >= 0 ? "+" : ""}${unitsNet.toFixed(1)}u`;
  const roiText = roi !== null ? `, ${roi.toFixed(0)}% ROI` : "";
  const recordText = `My verified record on Blitz.tips: ${record}, ${units}${roiText}. Every pick tracked before it happens — tail me 👇`;

  return (
    <div className="space-y-8">
      <div className="card p-5">
        <h2 className="text-lg font-bold">Share your verified record</h2>
        <p className="mt-1 text-sm text-muted">
          These branded cards pull straight from your live, verified stats — you can&apos;t fake them, which
          is exactly why they convert. Post your record after a good run, or drop a settled winner. Every
          share links back to your Blitz.tips profile.
        </p>
      </div>

      {/* Record card */}
      <div className="card overflow-hidden">
        <div className="border-b border-border px-5 py-3">
          <p className="font-semibold">Record card</p>
          <p className="text-xs text-muted">
            This is also the preview that shows whenever you post your profile link anywhere.
          </p>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-[1.4fr_1fr] md:items-center">
          <div className="overflow-hidden rounded-xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element -- dynamic OG PNG, sized fluidly */}
            <img src={recordImageUrl} alt={`${displayName} verified record card`} className="block w-full" />
          </div>
          <div className="space-y-3">
            <p className="text-sm text-muted">{recordText}</p>
            <ShareActions
              text={recordText}
              url={profileUrl}
              imageUrl={recordImageUrl}
              download={`${handle}-record.png`}
            />
          </div>
        </div>
      </div>

      {/* Pick cards */}
      <div>
        <h3 className="mb-3 font-semibold">Settled pick cards</h3>
        {picks.length === 0 ? (
          <div className="card p-6 text-center text-sm text-muted">
            Once your picks are graded they&apos;ll show here as shareable cards.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {picks.map((p) => {
              const imageUrl = `${baseUrl}/api/share/pick/${p.id}`;
              const text = `${p.result === "WIN" ? "✅ " : ""}${p.selection} — ${p.matchup}. Tracked & graded on Blitz.tips.`;
              return (
                <div key={p.id} className="card overflow-hidden">
                  <div className="overflow-hidden border-b border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element -- dynamic OG PNG, sized fluidly */}
                    <img src={imageUrl} alt={`${p.selection} share card`} className="block w-full" />
                  </div>
                  <div className="space-y-3 p-4">
                    <p className="text-sm">
                      <span className="font-semibold">{p.selection}</span>{" "}
                      <span className="text-muted">· {p.sportLabel} · {p.matchup}</span>
                    </p>
                    <ShareActions text={text} url={profileUrl} imageUrl={imageUrl} download={`${handle}-${p.id}.png`} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
