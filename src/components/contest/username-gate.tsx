"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AtSign, Loader2 } from "lucide-react";

/**
 * Claim a username before entering the contest.
 *
 * Shown in place of the join button for the accounts that can reach the contest
 * without one — Google signups who never finished onboarding. Inline rather
 * than a redirect: bouncing someone to a settings page at the moment they meant
 * to enter a contest is how you lose them.
 */
export function UsernameGate({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { update } = useSession();
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch("/api/account/username", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setBusy(false);
      setError(data.error ?? "Couldn't save that username");
      return;
    }

    // Refresh the JWT so the nav and anything else reading the session picks up
    // the new handle without a sign-out.
    await update();
    router.refresh();
    setBusy(false);
  }

  return (
    <div className={compact ? "" : "card border-accent/40 bg-accent/5 p-5"}>
      <p className="flex items-center gap-2 font-semibold">
        <AtSign className="h-4 w-4 text-accent" /> Choose your username
      </p>
      <p className="mt-1 text-sm text-muted">
        It&apos;s the name you&apos;ll appear under on the leaderboard and on your public entrant
        page. Pick it now and it&apos;s yours — usernames can&apos;t be changed later.
      </p>

      <form onSubmit={submit} className="mt-3 flex flex-wrap items-start gap-2">
        <div className="min-w-[12rem] flex-1">
          <input
            required
            minLength={3}
            maxLength={20}
            pattern="[a-zA-Z0-9_]+"
            title="3–20 letters, numbers, or underscores"
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <p className="mt-1 text-xs text-muted">3–20 letters, numbers or underscores.</p>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </button>
      </form>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
