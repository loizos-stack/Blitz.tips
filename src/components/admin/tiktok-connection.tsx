"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Link2, Send, Unlink } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";

/**
 * The TikTok half of Admin → Recaps: one connected account, and a per-video
 * "Send to drafts" button.
 *
 * Drafts, not posts. TikTok only lets an app publish straight to a profile
 * once it has passed their audit, and until then anything posted through the
 * API is forced private — so the useful thing an unaudited app can do is put
 * the finished file in the creator's inbox, which is what this does. The copy
 * says so, because "Send" that produces a draft rather than a post would
 * otherwise read as a bug.
 */

export interface TikTokAccountRow {
  openId: string;
  displayName: string | null;
  scopes: string;
  connectedAt: string;
}

export function TikTokConnection({
  account,
  configured,
  error,
}: {
  account: TikTokAccountRow | null;
  configured: boolean;
  /** Carried over from the OAuth callback's redirect. */
  error?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function disconnect() {
    setBusy(true);
    await fetchJson("/api/admin/tiktok/account", { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="card p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <Send className="h-4 w-4" /> TikTok
      </h2>

      {error && (
        <p className="mt-2 flex items-start gap-2 text-xs text-danger">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error === "unconfigured"
            ? "TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET aren't set, so there is nothing to connect to."
            : error}
        </p>
      )}

      {!configured ? (
        <p className="mt-1 text-sm text-muted">
          Set <code>TIKTOK_CLIENT_KEY</code> and <code>TIKTOK_CLIENT_SECRET</code> from your TikTok
          developer app, then come back here to connect the account.
        </p>
      ) : account ? (
        <>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-accent" />
            <span className="font-medium">{account.displayName ?? account.openId}</span>
            <span className="text-muted">
              connected {new Date(account.connectedAt).toLocaleDateString()}
            </span>
          </p>
          <p className="mt-2 text-xs text-muted">
            Videos are sent to this account&apos;s TikTok <strong>drafts</strong>, not posted. Open
            TikTok, add your caption and publish — that last tap is yours.
          </p>
          <button
            type="button"
            onClick={disconnect}
            disabled={busy}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:border-danger hover:text-danger disabled:opacity-60"
          >
            <Unlink className="h-3.5 w-3.5" /> {busy ? "Disconnecting…" : "Disconnect"}
          </button>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            Connect a TikTok account and each rendered recap can be pushed straight into its drafts,
            ready to caption and publish from the app.
          </p>
          <a
            href="/api/admin/tiktok/authorize"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
          >
            <Link2 className="h-3.5 w-3.5" /> Connect TikTok
          </a>
        </>
      )}
    </div>
  );
}

/** The per-video button. Separate so each row owns its own busy/result state. */
export function SendToTikTok({
  date,
  sent,
  failed,
  connected,
}: {
  date: string;
  /** Already pushed successfully — the button offers a re-send instead. */
  sent: boolean;
  failed: string | null;
  connected: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (!connected) return null;

  async function send() {
    setBusy(true);
    setNote(null);
    const res = await fetchJson<{ error?: string }>(
      `/api/cron/tiktok?date=${encodeURIComponent(date)}${sent ? "&force=1" : ""}`,
      { method: "POST" }
    );
    setBusy(false);
    if (!res.ok) setNote(res.error ?? "That didn't work.");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={send}
        disabled={busy}
        title={sent ? "Send again, replacing nothing — TikTok will hold a second draft." : undefined}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:border-accent hover:text-accent disabled:opacity-60"
      >
        <Send className="h-3.5 w-3.5" />
        {busy ? "Sending…" : sent ? "Re-send" : "To drafts"}
      </button>
      {sent && !failed && !note && <span className="text-xs text-accent">In TikTok drafts</span>}
      {(failed || note) && (
        <span className="max-w-[16rem] text-right text-xs text-danger">{note ?? failed}</span>
      )}
    </div>
  );
}
