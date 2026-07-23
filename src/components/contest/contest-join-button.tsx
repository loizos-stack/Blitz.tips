"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trophy } from "lucide-react";

// Enter-the-contest CTA. Renders a sign-in prompt for logged-out visitors, a
// disabled "You're in" once joined, or the join action otherwise.
export function ContestJoinButton({
  contestId,
  signedIn,
  joined,
  accepting,
}: {
  contestId: string;
  signedIn: boolean;
  joined: boolean;
  accepting: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <Link
        href="/signin?callbackUrl=/supercapper"
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:opacity-90"
      >
        <Trophy className="h-4 w-4" /> Sign in to enter — it&apos;s free
      </Link>
    );
  }

  if (joined) {
    return (
      <span className="inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-6 py-3 text-sm font-semibold text-accent">
        <Trophy className="h-4 w-4" /> You&apos;re entered
      </span>
    );
  }

  async function join() {
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/supercapper/${contestId}/join`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? "Could not enter the contest");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={join}
        disabled={loading || !accepting}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Trophy className="h-4 w-4" /> {loading ? "Entering…" : "Enter the contest — free"}
      </button>
      {!accepting && <span className="text-xs text-muted">Entries aren&apos;t open right now.</span>}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
