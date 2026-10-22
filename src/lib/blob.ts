import "server-only";
import { put } from "@vercel/blob";
import { promises as fs } from "node:fs";
import path from "node:path";

export type ProfileImageKind = "avatar" | "cover";
export type ImageScope = "handicappers" | "contest-entries";

/**
 * The Blob store's read/write token.
 *
 * Vercel injects it as BLOB_READ_WRITE_TOKEN by default, but a custom
 * env-prefix chosen when connecting the store yields e.g.
 * MYSTORE_READ_WRITE_TOKEN — accept any of them.
 *
 * `||` rather than `??` on the first branch: an env var explicitly set to an
 * empty string is a missing one, and `??` would return "" and skip the
 * prefix search.
 */
export function blobToken(): string | undefined {
  return (
    process.env.BLOB_READ_WRITE_TOKEN?.trim() ||
    Object.entries(process.env).find(([k, v]) => k.endsWith("_READ_WRITE_TOKEN") && v?.trim())?.[1]
  );
}

/**
 * Whether an upload would find somewhere to write. Used by the admin
 * integrations panel so it reports what `saveProfileImage` will actually do,
 * rather than guessing from one variable name.
 */
export function blobConfigured(): boolean {
  return Boolean(blobToken()) || Boolean(process.env.BLOB_LOCAL_DIR?.trim());
}

function extFor(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
}

/**
 * Persist a handicapper profile image and return its public URL.
 *
 * Production uses Vercel Blob (requires a Blob store — BLOB_READ_WRITE_TOKEN is
 * injected automatically once one is created). Setting BLOB_LOCAL_DIR (a path
 * under `public/`) instead writes to the local filesystem, which is only used
 * for local development/testing since Vercel's runtime filesystem is ephemeral.
 */
export async function saveProfileImage(
  profileId: string,
  kind: ProfileImageKind,
  bytes: Buffer,
  contentType: string,
  /** Storage namespace — separates handicapper profiles from contest entries. */
  scope: ImageScope = "handicappers"
): Promise<string> {
  const key = `${scope}/${profileId}/${kind}-${Date.now()}.${extFor(contentType)}`;

  const localDir = process.env.BLOB_LOCAL_DIR;
  if (localDir) {
    const abs = path.join(process.cwd(), localDir, key);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, bytes);
    const publicPrefix = localDir.replace(/^public\/?/, "");
    return "/" + path.posix.join(publicPrefix, key);
  }

  const token = blobToken();

  if (!token) {
    const candidates = Object.keys(process.env)
      .filter((k) => k.includes("BLOB") || k.includes("READ_WRITE"))
      .join(", ");
    throw new Error(
      "Image uploads aren't configured yet. Connect a Vercel Blob store to this project and redeploy." +
        (candidates ? ` (Blob-related env vars found: ${candidates})` : " (No Blob-related env vars found in this deployment.)")
    );
  }

  const blob = await put(key, bytes, { access: "public", contentType, token });
  return blob.url;
}
