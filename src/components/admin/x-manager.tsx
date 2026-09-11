"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Send, Info, Check, AlertCircle, Link2, Unlink, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/date-format";
import { fetchJson } from "@/lib/fetch-json";

/** X counts codepoints. Mirrors xLength() on the server so the two agree. */
const MAX_CHARS = 280;
const count = (s: string) => [...s].length;

interface XPostRow {
  id: string;
  username: string;
  text: string;
  asset: string | null;
  tweetId: string | null;
  ok: boolean;
  error: string | null;
  source: string | null;
  sentByEmail: string;
  createdAt: string;
}

interface Account {
  username: string;
  name: string | null;
  scopes: string;
  connectedAt: string;
  expiresAt: string;
}

interface Props {
  configured: boolean;
  assets: string[];
  account: Account | null | undefined;
  posts: XPostRow[];
}

export function XManager({ configured, assets, account, posts }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [text, setText] = useState("");
  const [asset, setAsset] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error"));
  const [posted, setPosted] = useState<string | null>(null);

  const chars = count(text);
  const over = chars > MAX_CHARS;

  async function publish() {
    setBusy(true);
    setError(null);
    setPosted(null);
    const res = await fetchJson<{ url: string | null }>("/api/admin/x/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, asset: asset || null }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "The post failed.");
      // Refresh anyway: a failed attempt is recorded, and seeing it in the
      // history is how you tell "X refused it" from "the request never landed".
      router.refresh();
      return;
    }
    setPosted(res.data?.url ?? null);
    setText("");
    setAsset("");
    router.refresh();
  }

  async function disconnect() {
    setBusy(true);
    await fetchJson("/api/admin/x/account", { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  if (!configured) {
    return (
      <div className="card p-6">
        <h1 className="text-xl font-bold">X</h1>
        <p className="mt-2 text-sm text-muted">
          Set <code>X_CLIENT_ID</code> and <code>X_CLIENT_SECRET</code> to post to X. They come from an app in
          the X developer portal, with <code>{"https://blitz.tips/api/admin/x/callback"}</code> registered as a
          callback URL.
        </p>
        <p className="mt-2 text-sm text-muted">
          Posting also needs an access tier that permits writes. A plan that only reads will connect an account
          successfully and then reject every post with a 403.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">X</h1>
        <p className="mt-1 text-sm text-muted">Post to the connected account. Every attempt is recorded below.</p>
      </div>

      {/* Account */}
      <div className="card p-5">
        <h2 className="font-semibold">Account</h2>
        {account ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <p className="font-semibold">
                @{account.username}
                {account.name && <span className="ml-2 font-normal text-muted">{account.name}</span>}
              </p>
              <p className="mt-1 text-xs text-muted">
                Connected {formatDateTime(account.connectedAt)} · scopes {account.scopes.split(" ").join(", ")}
              </p>
              {!account.scopes.includes("offline.access") && (
                <p className="mt-1 text-xs text-danger">
                  No <code>offline.access</code> scope — the grant can&apos;t be refreshed and will stop working
                  when it expires. Reconnect to fix.
                </p>
              )}
            </div>
            <button
              onClick={disconnect}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:border-danger hover:text-danger disabled:opacity-60"
            >
              <Unlink className="h-4 w-4" /> Disconnect
            </button>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">No account connected.</p>
            <a
              href="/api/admin/x/authorize"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
            >
              <Link2 className="h-4 w-4" /> Connect X account
            </a>
          </div>
        )}
        <p className="mt-3 flex items-start gap-2 text-xs text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Disconnecting removes our copy of the tokens. It doesn&apos;t revoke the grant at X — to be certain,
          also remove the app under X&apos;s connected-apps settings.
        </p>
      </div>

      {/* Composer */}
      <div className="card p-5">
        <h2 className="font-semibold">New post</h2>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="What's happening?"
          className="mt-3 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <select
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            <option value="">No attachment</option>
            {assets.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <span className={cn("text-sm tabular-nums", over ? "font-semibold text-danger" : "text-muted")}>
            {chars} / {MAX_CHARS}
          </span>
        </div>

        {error && (
          <p className="mt-3 flex items-start gap-2 text-sm text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </p>
        )}
        {posted && (
          <p className="mt-3 flex items-center gap-2 text-sm text-accent">
            <Check className="h-4 w-4" /> Posted.{" "}
            <a href={posted} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">
              View on X <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        )}

        <button
          onClick={publish}
          disabled={busy || !account || !text.trim() || over}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          <Send className="h-4 w-4" /> {busy ? "Posting…" : "Post to X"}
        </button>
        {!account && <p className="mt-2 text-xs text-muted">Connect an account first.</p>}
      </div>

      {/* History */}
      <div className="card p-5">
        <h2 className="font-semibold">Recent posts</h2>
        {posts.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing posted yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {posts.map((p) => (
              <li key={p.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm">{p.text}</p>
                    <p className="mt-1 text-xs text-muted">
                      @{p.username} · {formatDateTime(p.createdAt)} · {p.sentByEmail}
                      {p.asset && <> · {p.asset}</>}
                      {p.source && <> · auto: {p.source}</>}
                    </p>
                    {p.error && <p className="mt-1 text-xs text-danger">{p.error}</p>}
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                      p.ok ? "bg-accent/10 text-accent" : "bg-danger/10 text-danger"
                    )}
                  >
                    {p.ok ? "Sent" : "Failed"}
                  </span>
                </div>
                {p.ok && p.tweetId && (
                  <a
                    href={`https://x.com/${p.username}/status/${p.tweetId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-muted hover:text-accent"
                  >
                    View on X <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
