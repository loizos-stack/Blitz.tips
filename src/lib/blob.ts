import "server-only";
import { put } from "@vercel/blob";
import { promises as fs } from "node:fs";
import path from "node:path";

export type ProfileImageKind = "avatar" | "cover";

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
  contentType: string
): Promise<string> {
  const key = `handicappers/${profileId}/${kind}-${Date.now()}.${extFor(contentType)}`;

  const localDir = process.env.BLOB_LOCAL_DIR;
  if (localDir) {
    const abs = path.join(process.cwd(), localDir, key);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, bytes);
    const publicPrefix = localDir.replace(/^public\/?/, "");
    return "/" + path.posix.join(publicPrefix, key);
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "Image uploads aren't configured yet. Create a Vercel Blob store so BLOB_READ_WRITE_TOKEN is available."
    );
  }

  const blob = await put(key, bytes, { access: "public", contentType });
  return blob.url;
}
