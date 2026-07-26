"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Heart, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// The current user's follow set is the same for every button on a page, so we
// fetch it once and share the promise across all mounted buttons.
type FollowState = { signedIn: boolean; ids: Set<string> };
let sharedState: Promise<FollowState> | null = null;

function loadFollowState(): Promise<FollowState> {
  if (!sharedState) {
    sharedState = fetch("/api/follow")
      .then((r) => r.json())
      .then((j) => ({ signedIn: Boolean(j.signedIn), ids: new Set<string>(j.handicapperIds ?? []) }))
      .catch(() => ({ signedIn: false, ids: new Set<string>() }));
  }
  return sharedState;
}

export function FollowButton({
  handicapperId,
  initialFollowing,
  className,
  size = "md",
}: {
  handicapperId: string;
  /** When known server-side (e.g. the profile page), skip the shared fetch. */
  initialFollowing?: boolean;
  className?: string;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [following, setFollowing] = useState(initialFollowing ?? false);
  const [ready, setReady] = useState(initialFollowing !== undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialFollowing !== undefined) return;
    let active = true;
    loadFollowState().then((s) => {
      if (active) {
        setFollowing(s.ids.has(handicapperId));
        setReady(true);
      }
    });
    return () => {
      active = false;
    };
  }, [handicapperId, initialFollowing]);

  async function toggle(e: React.MouseEvent) {
    // These buttons often sit inside a card that is itself a link.
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;

    const next = !following;
    setBusy(true);
    const res = await fetch("/api/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handicapperId, follow: next }),
    });
    setBusy(false);

    if (res.status === 401) {
      router.push(`/signin?callbackUrl=${encodeURIComponent(pathname ?? "/")}`);
      return;
    }
    if (!res.ok) return;

    setFollowing(next);
    // Keep the shared cache in sync so other buttons on the page agree.
    const s = await loadFollowState();
    if (next) s.ids.add(handicapperId);
    else s.ids.delete(handicapperId);
  }

  const sizing = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={following}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border font-semibold transition-colors disabled:opacity-60",
        sizing,
        following
          ? "border-border bg-surface-raised text-muted hover:text-foreground"
          : "border-danger/40 text-danger hover:border-danger hover:bg-danger/10",
        !ready && "opacity-0",
        className
      )}
    >
      {following ? (
        <>
          <Check className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} /> Following
        </>
      ) : (
        <>
          <Heart className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} /> Follow
        </>
      )}
    </button>
  );
}
