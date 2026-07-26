"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Loader2 } from "lucide-react";
import { Avatar } from "@/components/avatar";

// Load a File into an HTMLImageElement.
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image"));
    };
    img.src = url;
  });
}

// Center-crop and resize to exact target dimensions, returning a JPEG blob.
// Keeps uploads small (and cheap to store) regardless of the source file.
async function resizeToBlob(file: File, targetW: number, targetH: number): Promise<Blob> {
  const img = await loadImage(file);
  const scale = Math.max(targetW / img.width, targetH / img.height);
  const cropW = targetW / scale;
  const cropH = targetH / scale;
  const sx = (img.width - cropW) / 2;
  const sy = (img.height - cropH) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, targetW, targetH);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not process image"))),
      "image/jpeg",
      0.85
    );
  });
}

const DIMENSIONS = {
  avatar: { w: 400, h: 400 },
  cover: { w: 1600, h: 500 },
} as const;

export function ProfileImagesForm({
  avatarUrl,
  coverUrl,
  displayName,
}: {
  avatarUrl: string | null;
  coverUrl: string | null;
  displayName: string;
}) {
  const router = useRouter();
  const [avatar, setAvatar] = useState(avatarUrl);
  const [cover, setCover] = useState(coverUrl);
  const [busy, setBusy] = useState<null | "avatar" | "cover">(null);
  const [error, setError] = useState<string | null>(null);

  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  async function handleFile(kind: "avatar" | "cover", file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(kind);
    try {
      const { w, h } = DIMENSIONS[kind];
      const resized = await resizeToBlob(file, w, h);
      const body = new FormData();
      body.set("kind", kind);
      body.set("file", new File([resized], `${kind}.jpg`, { type: "image/jpeg" }));

      const res = await fetch("/api/handicapper/image", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      if (kind === "avatar") setAvatar(data.url);
      else setCover(data.url);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card overflow-hidden p-0">
      {/* Cover */}
      <button
        type="button"
        onClick={() => coverInput.current?.click()}
        className="group relative block h-36 w-full overflow-hidden bg-surface-raised"
        aria-label="Change cover image"
      >
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded cover (Vercel Blob URL)
          <img src={cover} alt="Cover" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-accent/20 via-surface-raised to-gold/15" />
        )}
        <span className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 text-sm font-medium text-white/0 transition group-hover:bg-black/40 group-hover:text-white">
          {busy === "cover" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {busy === "cover" ? "Uploading…" : "Change cover"}
        </span>
      </button>

      <div className="flex items-end gap-4 px-5 pb-5">
        {/* Avatar */}
        <button
          type="button"
          onClick={() => avatarInput.current?.click()}
          className="group relative -mt-10 h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 border-surface bg-surface-raised"
          aria-label="Change profile photo"
        >
          <Avatar src={avatar} name={displayName} className="h-full w-full text-lg" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white/0 transition group-hover:bg-black/40 group-hover:text-white">
            {busy === "avatar" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          </span>
        </button>

        <div className="min-w-0 pb-1">
          <p className="text-sm font-semibold">Profile images</p>
          <p className="text-xs text-muted">
            Click the cover or photo to upload. Square photo, wide cover — JPG, PNG, or WebP.
          </p>
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </div>
      </div>

      <input
        ref={avatarInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleFile("avatar", e.target.files?.[0])}
      />
      <input
        ref={coverInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleFile("cover", e.target.files?.[0])}
      />
    </div>
  );
}
