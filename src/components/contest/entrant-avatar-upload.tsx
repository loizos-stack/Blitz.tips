"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, Loader2 } from "lucide-react";
import { EntrantAvatar } from "@/components/contest/entrant-avatar";

/**
 * Avatar control on the entrant dashboard.
 *
 * A handicapper sees their picture and where it comes from rather than an
 * upload button — their contest identity reuses the handicapper profile avatar,
 * so an upload here would store something that never renders.
 */
export function EntrantAvatarUpload({
  name,
  avatarUrl,
  fromHandicapper,
}: {
  name: string;
  avatarUrl: string | null;
  fromHandicapper: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/supercapper/avatar", { method: "POST", body });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Upload failed");
      return;
    }
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    setError(null);
    await fetch("/api/supercapper/avatar", { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-4">
      <EntrantAvatar name={name} avatarUrl={avatarUrl} className="h-16 w-16 text-2xl" sizes="64px" />

      <div className="min-w-0">
        <p className="font-semibold">{name}</p>

        {fromHandicapper ? (
          <p className="mt-0.5 text-xs text-muted">
            {avatarUrl
              ? "Using your handicapper profile picture. Change it there and it updates across the contest too."
              : "Your contest picture comes from your handicapper profile — set one there and it shows up here too."}{" "}
            <Link href="/dashboard/handicapper/profile" className="font-medium text-accent hover:underline">
              Edit profile
            </Link>
          </p>
        ) : (
          <>
            <p className="mt-0.5 text-xs text-muted">
              Shown wherever your name appears on the contest pages. JPEG, PNG or WebP, up to 4MB.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-accent disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                {avatarUrl ? "Change picture" : "Upload a picture"}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove()}
                  className="text-xs font-medium text-muted hover:text-danger disabled:opacity-60"
                >
                  Remove
                </button>
              )}
            </div>
          </>
        )}

        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Reset so picking the same file twice still fires a change event.
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
    </div>
  );
}
