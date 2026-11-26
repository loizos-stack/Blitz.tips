import "server-only";

/**
 * Fetching an image so Satori never has to.
 *
 * next/og can load a remote URL itself, and that is the trap: a fetch it makes
 * internally which fails throws, and the whole card 500s rather than losing one
 * picture. The share cards pull from three different hosts — a handicapper's
 * uploaded avatar, ESPN's crests, TheSportsDB's player cut-outs — so something
 * failing is not an edge case, it is a Tuesday.
 *
 * So every image is fetched here first and inlined as a data URI. Any failure at
 * all degrades to null, and the card draws its fallback: a monogram, or simply
 * no crest.
 *
 * Lifted out of handicappers/[handle]/opengraph-image.tsx, where it lived as a
 * local helper, once the pick card needed the same thing for three images at
 * once. That multiplied the reason for the timeout below: one slow host should
 * not hold a share card open, and three of them certainly should not.
 */

const DEFAULT_TIMEOUT_MS = 2500;
const MAX_BYTES = 3_000_000;

export async function toDataUri(
  url: string | null | undefined,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: { timeoutMs?: number } = {}
): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    // Not just politeness: handing Satori an HTML error page as an <img> src is
    // another way to make it throw.
    if (!type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Several at once, each failing independently. */
export async function toDataUris(
  urls: (string | null | undefined)[],
  opts?: { timeoutMs?: number }
): Promise<(string | null)[]> {
  return Promise.all(urls.map((u) => toDataUri(u, opts)));
}
