import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * X (Twitter) posting for the admin panel.
 *
 * ## Why this is bigger than the Telegram equivalent
 *
 * Telegram takes a bot token from the environment and that is the whole story.
 * X will not accept a post from an app on its own behalf — `POST /2/tweets`
 * requires *user context*, so the panel holds an OAuth 2.0 grant belonging to
 * the account being posted as. Grants expire (a couple of hours), so there is a
 * refresh token to keep, refresh, and re-store. That is the entire reason this
 * file has a database dependency and lib/telegram.ts does not.
 *
 * ## Tokens are secrets, and are stored as such
 *
 * A refresh token is a live credential: whoever holds it can post as the
 * account until it is revoked. It is encrypted at rest with AES-256-GCM rather
 * than written to a column in the clear.
 *
 * The key is derived from AUTH_SECRET rather than being its own variable. That
 * is deliberate: a separate secret is one more thing to set, to rotate, and to
 * lose — and losing it silently breaks posting in a way that looks like an X
 * outage. AUTH_SECRET already exists, is already required, and already has the
 * property that leaking it is game over anyway. X_TOKEN_KEY overrides it for
 * anyone who wants the separation.
 *
 * Rotating either key doesn't corrupt anything: decryption fails cleanly and
 * the panel asks you to reconnect the account.
 */

/** Testing hook — point the client at a stub. Leave unset in production. */
const API_BASE = process.env.X_API_BASE?.replace(/\/+$/, "") || "https://api.x.com";
/** Same, for the OAuth endpoints, which live on a different host in production. */
const OAUTH_BASE = process.env.X_OAUTH_BASE?.replace(/\/+$/, "") || "https://x.com";

const clientId = process.env.X_CLIENT_ID ?? "";
const clientSecret = process.env.X_CLIENT_SECRET ?? "";

/**
 * Scopes requested. `offline.access` is the one that matters most — without it
 * X returns no refresh token, the grant dies in two hours, and someone has to
 * reconnect the account by hand every time they want to post.
 */
export const X_SCOPES = ["tweet.read", "tweet.write", "users.read", "media.write", "offline.access"];

/** A post is refused above this. X counts codepoints, not UTF-16 units. */
export const X_MAX_CHARS = 280;

/** Refresh this far ahead of expiry, so a post never races the clock. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

const POST_TIMEOUT_MS = 20_000;
const MEDIA_TIMEOUT_MS = 60_000;
const TOKEN_TIMEOUT_MS = 15_000;

export function xConfigured(): boolean {
  return clientId.length > 0 && clientSecret.length > 0;
}

// --- Token encryption ------------------------------------------------------

function encryptionKey(): Buffer {
  const material = process.env.X_TOKEN_KEY || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
  if (!material) throw new Error("No AUTH_SECRET (or X_TOKEN_KEY) — cannot encrypt X tokens.");
  // SHA-256 of the secret gives exactly the 32 bytes AES-256 wants, whatever
  // length the secret happens to be.
  return createHash("sha256").update(material).digest();
}

/** iv:tag:ciphertext, all base64url. Self-describing, so no schema changes. */
export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64url")).join(":");
}

/**
 * Returns null rather than throwing on anything malformed — a rotated
 * AUTH_SECRET makes every stored token undecryptable, and that should surface
 * as "reconnect the account", not as a 500 on the admin page.
 */
export function decryptToken(blob: string): string | null {
  try {
    const [ivB64, tagB64, dataB64] = blob.split(":");
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivB64, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// --- OAuth 2.0 with PKCE ---------------------------------------------------

export interface PkcePair {
  verifier: string;
  challenge: string;
}

/**
 * PKCE, even though this is a confidential client with a secret.
 *
 * X requires it, and it costs nothing: the verifier never leaves the server, so
 * an intercepted authorization code is useless without it.
 */
export function createPkce(): PkcePair {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function authorizeUrl(opts: { redirectUri: string; state: string; challenge: string }): string {
  const url = new URL(`${OAUTH_BASE}/i/oauth2/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", opts.redirectUri);
  url.searchParams.set("scope", X_SCOPES.join(" "));
  url.searchParams.set("state", opts.state);
  url.searchParams.set("code_challenge", opts.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

function basicAuth(): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE}/2/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: basicAuth() },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`X token request failed (${res.status}): ${text.slice(0, 300)}`);
  return JSON.parse(text) as TokenResponse;
}

export async function exchangeCode(opts: { code: string; verifier: string; redirectUri: string }) {
  return tokenRequest({
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: opts.redirectUri,
    code_verifier: opts.verifier,
  });
}

// --- Connected account -----------------------------------------------------

export interface ConnectedAccount {
  username: string;
  name: string | null;
  xUserId: string;
  scopes: string;
  expiresAt: Date;
  connectedAt: Date;
}

export async function getConnectedAccount(): Promise<ConnectedAccount | null> {
  const row = await prisma.xAccount.findUnique({ where: { id: "default" } });
  if (!row) return null;
  return {
    username: row.username,
    name: row.name,
    xUserId: row.xUserId,
    scopes: row.scopes,
    expiresAt: row.expiresAt,
    connectedAt: row.connectedAt,
  };
}

export async function saveAccount(opts: {
  xUserId: string;
  username: string;
  name: string | null;
  token: TokenResponse;
  connectedBy: string;
}): Promise<void> {
  const data = {
    xUserId: opts.xUserId,
    username: opts.username,
    name: opts.name,
    accessToken: encryptToken(opts.token.access_token),
    refreshToken: opts.token.refresh_token ? encryptToken(opts.token.refresh_token) : null,
    expiresAt: new Date(Date.now() + opts.token.expires_in * 1000),
    scopes: opts.token.scope ?? X_SCOPES.join(" "),
    connectedBy: opts.connectedBy,
  };
  await prisma.xAccount.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data });
}

export async function disconnectAccount(): Promise<void> {
  await prisma.xAccount.deleteMany({ where: { id: "default" } });
}

/**
 * A usable access token, refreshed if it is close to expiring.
 *
 * Refreshing ahead of expiry rather than on a 401 keeps the failure modes
 * separate: after this returns, a 401 from X means the grant was revoked, not
 * that a token aged out mid-request.
 *
 * X rotates refresh tokens — each refresh returns a new one and invalidates the
 * old — so the response is written back before it is used. Dropping that write
 * strands the account on a dead token with no way back but reconnecting.
 */
type TokenResult = { ok: true; token: string } | { ok: false; error: string };

async function accessToken(): Promise<TokenResult> {
  const row = await prisma.xAccount.findUnique({ where: { id: "default" } });
  if (!row) return { ok: false, error: "No X account is connected." };

  if (row.expiresAt.getTime() - Date.now() > REFRESH_MARGIN_MS) {
    const token = decryptToken(row.accessToken);
    if (token) return { ok: true, token };
    return { ok: false, error: "Stored X credentials could not be read. Reconnect the account." };
  }

  const refresh = row.refreshToken ? decryptToken(row.refreshToken) : null;
  if (!refresh) {
    return { ok: false, error: "The X grant expired and there is no refresh token. Reconnect the account." };
  }

  try {
    const next = await tokenRequest({ grant_type: "refresh_token", refresh_token: refresh });
    await prisma.xAccount.update({
      where: { id: "default" },
      data: {
        accessToken: encryptToken(next.access_token),
        // Only overwrite when X sends a new one; a missing field must not wipe
        // the working token we already hold.
        ...(next.refresh_token ? { refreshToken: encryptToken(next.refresh_token) } : {}),
        expiresAt: new Date(Date.now() + next.expires_in * 1000),
        ...(next.scope ? { scopes: next.scope } : {}),
      },
    });
    return { ok: true, token: next.access_token };
  } catch (e) {
    return { ok: false, error: `Could not refresh the X grant: ${String(e)}. Reconnect the account.` };
  }
}

// --- Posting ---------------------------------------------------------------

export interface PostResult {
  ok: boolean;
  tweetId: string | null;
  error: string | null;
}

/** Codepoints, matching how X counts — "🙂".length is 2 in JS but 1 to X. */
export function xLength(text: string): number {
  return [...text].length;
}

export async function getMe(token: string): Promise<{ id: string; username: string; name: string | null } | null> {
  const res = await fetch(`${API_BASE}/2/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(POST_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: { id: string; username: string; name?: string } };
  if (!body.data) return null;
  return { id: body.data.id, username: body.data.username, name: body.data.name ?? null };
}

/**
 * Uploads one image or video and returns its media id.
 *
 * Separate call, separate timeout: a 4MB video upload has nothing in common
 * with a 280-character POST, and holding both to the same deadline means either
 * text posts wait too long to fail or uploads are cut off mid-transfer.
 */
export type UploadResult = { id: string } | { error: string };

function mediaCategory(mime: string): string {
  if (mime.startsWith("video/")) return "tweet_video";
  if (mime === "image/gif") return "tweet_gif";
  return "tweet_image";
}

/** Chunks must be under 5MB; well under keeps each APPEND comfortably inside its timeout. */
const CHUNK_BYTES = 2 * 1024 * 1024;
/** Give up polling a transcode rather than sitting on the request until the platform kills it. */
const PROCESS_POLL_LIMIT_MS = 35_000;

interface UploadResponse {
  data?: { id?: string; media_key?: string; processing_info?: ProcessingInfo };
  media_id_string?: string;
  processing_info?: ProcessingInfo;
}

interface ProcessingInfo {
  state?: string;
  check_after_secs?: number;
  error?: { message?: string; name?: string };
}

function readId(body: UploadResponse): string | undefined {
  return body.data?.id ?? body.media_id_string;
}

async function uploadForm(token: string, form: FormData, timeout: number): Promise<UploadResponse | { error: string }> {
  const res = await fetch(`${API_BASE}/2/media/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    signal: AbortSignal.timeout(timeout),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) return { error: `Media upload failed (${res.status}): ${text.slice(0, 300)}` };
  // APPEND answers 204 with no body at all. Parsing that as JSON throws, which
  // would fail every chunked upload on its first segment — so an empty body from
  // a successful response is success, not a malformed reply.
  if (text.trim() === "") return {};
  try {
    return JSON.parse(text) as UploadResponse;
  } catch {
    return { error: `Media upload returned a non-JSON body: ${text.slice(0, 200)}` };
  }
}

/**
 * Uploads one image or video and returns its media id.
 *
 * Three things here are easy to get wrong, and getting any of them wrong
 * produces the same unhelpful `{"detail":"Bad Request","status":400}` with
 * nothing naming the cause:
 *
 *  - `media_type` is required. Omitting it is a 400 with no explanation.
 *  - The file part needs a *filename*. Appending a Blob to FormData without one
 *    produces a part with no filename attribute, which the endpoint rejects.
 *  - Video cannot use the simple upload at all. It has to go through
 *    INIT/APPEND/FINALIZE and then be waited on while X transcodes it.
 *
 * Separate timeouts from the text post: a 4MB video has nothing in common with
 * a 280-character POST, and one deadline for both means either text posts wait
 * too long to fail or uploads are cut off mid-transfer.
 */
export async function uploadMedia(
  token: string,
  bytes: Buffer,
  mime: string,
  filename = "upload"
): Promise<UploadResult> {
  try {
    return mime.startsWith("video/")
      ? await uploadChunked(token, bytes, mime, filename)
      : await uploadSimple(token, bytes, mime, filename);
  } catch (e) {
    return { error: isTimeout(e) ? "Media upload timed out." : `Media upload failed: ${String(e)}` };
  }
}

async function uploadSimple(token: string, bytes: Buffer, mime: string, filename: string): Promise<UploadResult> {
  const form = new FormData();
  // The third argument is the filename, and it is not optional in practice.
  form.append("media", new Blob([new Uint8Array(bytes)], { type: mime }), filename);
  form.append("media_type", mime);
  form.append("media_category", mediaCategory(mime));

  const body = await uploadForm(token, form, MEDIA_TIMEOUT_MS);
  if ("error" in body) return body;
  const id = readId(body);
  return id ? { id } : { error: "Media upload returned no id." };
}

/**
 * The chunked path, which video requires.
 *
 * Written from X's documented INIT/APPEND/FINALIZE sequence; it could not be
 * exercised against the live API from the build environment, so the first real
 * video post is the one that proves it. Every step reports which step failed,
 * precisely so that first attempt is diagnosable rather than another bare 400.
 */
async function uploadChunked(token: string, bytes: Buffer, mime: string, filename: string): Promise<UploadResult> {
  const init = new FormData();
  init.append("command", "INIT");
  init.append("total_bytes", String(bytes.byteLength));
  init.append("media_type", mime);
  init.append("media_category", mediaCategory(mime));

  const initBody = await uploadForm(token, init, MEDIA_TIMEOUT_MS);
  if ("error" in initBody) return { error: `INIT: ${initBody.error}` };
  const mediaId = readId(initBody);
  if (!mediaId) return { error: "INIT returned no media id." };

  for (let offset = 0, segment = 0; offset < bytes.byteLength; offset += CHUNK_BYTES, segment++) {
    const chunk = bytes.subarray(offset, Math.min(offset + CHUNK_BYTES, bytes.byteLength));
    const append = new FormData();
    append.append("command", "APPEND");
    append.append("media_id", mediaId);
    append.append("segment_index", String(segment));
    append.append("media", new Blob([new Uint8Array(chunk)], { type: mime }), filename);

    const res = await uploadForm(token, append, MEDIA_TIMEOUT_MS);
    if ("error" in res) return { error: `APPEND segment ${segment}: ${res.error}` };
  }

  const finalize = new FormData();
  finalize.append("command", "FINALIZE");
  finalize.append("media_id", mediaId);
  const finalBody = await uploadForm(token, finalize, MEDIA_TIMEOUT_MS);
  if ("error" in finalBody) return { error: `FINALIZE: ${finalBody.error}` };

  const processing = finalBody.data?.processing_info ?? finalBody.processing_info;
  if (!processing || processing.state === "succeeded") return { id: mediaId };

  const waited = await awaitProcessing(token, mediaId, processing);
  return waited ? { error: waited } : { id: mediaId };
}

/** Polls until X finishes transcoding. Returns an error string, or null on success. */
async function awaitProcessing(token: string, mediaId: string, first: ProcessingInfo): Promise<string | null> {
  const deadline = Date.now() + PROCESS_POLL_LIMIT_MS;
  let info = first;

  while (info.state === "pending" || info.state === "in_progress") {
    if (Date.now() >= deadline) {
      return "X is still processing the video after 35s. It may finish on its own — check the account before retrying, so you don't post twice.";
    }
    // Honour X's own backoff hint, floored so a missing value can't spin.
    await new Promise((r) => setTimeout(r, Math.max(1, info.check_after_secs ?? 2) * 1000));

    const res = await fetch(`${API_BASE}/2/media/upload?command=STATUS&media_id=${encodeURIComponent(mediaId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return `STATUS check failed (${res.status}).`;
    const body = (await res.json()) as UploadResponse;
    info = body.data?.processing_info ?? body.processing_info ?? { state: "succeeded" };
  }

  if (info.state === "failed") {
    return `X failed to process the video: ${info.error?.message ?? info.error?.name ?? "no reason given"}.`;
  }
  return null;
}

function isTimeout(e: unknown): boolean {
  const name = (e as { name?: string } | null)?.name;
  return name === "TimeoutError" || name === "AbortError";
}

/**
 * What a rejection from /2/tweets actually means.
 *
 * These three look alike from the outside — a failed post — and lead to
 * entirely different places. Getting them confused costs real time: a 402 was
 * once read as a tier problem and sent someone looking at app permissions when
 * the account had simply run out of credits.
 */
function describeXRejection(status: number): string {
  if (status === 402) {
    return (
      " — your X API credits are exhausted. This is billing, not configuration:" +
      " nothing in the app or its permissions will change it. Top up or change plan" +
      " under Products/Billing in the X developer portal."
    );
  }
  if (status === 403) {
    return (
      " — usually the app's permission is set to Read rather than Read and write," +
      " or tweet.write wasn't granted. Note that changing the permission is not enough" +
      " on its own: scopes are fixed when the account connects, so disconnect and" +
      " reconnect afterwards."
    );
  }
  if (status === 429) {
    return " — rate limited. Wait for the window to reset rather than retrying immediately.";
  }
  return "";
}

/**
 * Publishes a post. Never throws — the caller records the outcome either way,
 * and a failed post is the history row you most want to keep.
 */
export async function postTweet(opts: {
  text: string;
  media?: { bytes: Buffer; mime: string; filename?: string };
}): Promise<PostResult> {
  if (!xConfigured()) return { ok: false, tweetId: null, error: "X_CLIENT_ID / X_CLIENT_SECRET are not set." };
  if (xLength(opts.text) > X_MAX_CHARS) {
    return { ok: false, tweetId: null, error: `Post is ${xLength(opts.text)} characters; the limit is ${X_MAX_CHARS}.` };
  }

  const auth = await accessToken();
  if (!auth.ok) return { ok: false, tweetId: null, error: auth.error };

  let mediaIds: string[] | undefined;
  if (opts.media) {
    const up = await uploadMedia(auth.token, opts.media.bytes, opts.media.mime, opts.media.filename);
    if ("error" in up) return { ok: false, tweetId: null, error: up.error };
    mediaIds = [up.id];
  }

  try {
    const res = await fetch(`${API_BASE}/2/tweets`, {
      method: "POST",
      headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: opts.text, ...(mediaIds ? { media: { media_ids: mediaIds } } : {}) }),
      signal: AbortSignal.timeout(POST_TIMEOUT_MS),
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      // 403 here is usually the access tier rather than a bad request, and
      // saying so saves a long hunt through the developer portal.
      // The status is the diagnosis here, and each one points somewhere
      // completely different. Naming them saves a hunt through the developer
      // portal that otherwise starts by suspecting this code.
      const hint = describeXRejection(res.status);
      return { ok: false, tweetId: null, error: `X rejected the post (${res.status})${hint}: ${text.slice(0, 300)}` };
    }
    const body = JSON.parse(text) as { data?: { id?: string } };
    return { ok: true, tweetId: body.data?.id ?? null, error: null };
  } catch (e) {
    return { ok: false, tweetId: null, error: isTimeout(e) ? "X timed out." : `X request failed: ${String(e)}` };
  }
}
