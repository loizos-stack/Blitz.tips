import "server-only";
import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { makeTokenCrypto } from "@/lib/token-crypto";

/**
 * TikTok Content Posting API — drafts only.
 *
 * ## Why drafts and not direct posting
 *
 * TikTok gates the two modes behind different scopes. `video.publish` posts
 * straight to the profile; `video.upload` drops the file into the creator's
 * TikTok inbox as a draft, and they finish and publish it in the app.
 *
 * Direct posting needs the app to pass TikTok's audit. Until it does, anything
 * posted through the API is forced to SELF_ONLY — private — which for a
 * marketing reel is the same as not posting it. The draft route carries no
 * such restriction.
 *
 * So this asks for `video.upload` alone and stops at the draft. It removes the
 * part that actually costs time — rendering, downloading, moving a file to a
 * phone — and leaves a one-tap publish. If the audit is granted later, direct
 * posting is a second scope and a different init endpoint, not a rewrite.
 *
 * `creator_info/query` is deliberately not called: TikTok documents it under
 * the `video.publish` scope, and it exists to populate the privacy and
 * interaction controls of an export page. A draft has no such page.
 *
 * ## Verified against
 *
 * TikTok's own developer docs are unreachable from the build environment, so
 * the request shapes here come from their published reference as reported by
 * secondary sources. The field names are the documented ones, but the first
 * live run is the real test — `pushVideo` returns TikTok's own error text
 * rather than swallowing it, precisely so that run is diagnosable.
 */

const clientKey = process.env.TIKTOK_CLIENT_KEY ?? "";
const clientSecret = process.env.TIKTOK_CLIENT_SECRET ?? "";

/** Overridable so tests can point at a stub instead of the live API. */
const API_BASE = (process.env.TIKTOK_API_BASE?.trim() || "https://open.tiktokapis.com").replace(/\/+$/, "");
const AUTH_BASE = (process.env.TIKTOK_AUTH_BASE?.trim() || "https://www.tiktok.com").replace(/\/+$/, "");

/**
 * Drafts only. Asking for `video.publish` as well would put the app in front of
 * TikTok's audit for a capability nothing here uses, and the audit reviews
 * every scope requested.
 */
export const TIKTOK_SCOPES = ["user.info.basic", "video.upload"];

const TOKEN_TIMEOUT_MS = 15_000;
const API_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 120_000;

/** Refresh this far ahead of expiry, so a push never races the clock. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/**
 * TikTok wants chunks of at least 5MB. Our recap videos are capped at 4MB by
 * the upload route, so they always go as a single whole-file chunk — which is
 * explicitly allowed, and is why there is no chunking loop here. If that cap
 * ever rises above 64MB this needs one.
 */
export const TIKTOK_SINGLE_CHUNK_LIMIT = 64 * 1024 * 1024;

export function tiktokConfigured(): boolean {
  return clientKey.length > 0 && clientSecret.length > 0;
}

const crypto_ = makeTokenCrypto(["TIKTOK_TOKEN_KEY", "AUTH_SECRET", "NEXTAUTH_SECRET"], "TikTok");

// --- OAuth -----------------------------------------------------------------

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export function createPkce(): PkcePair {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function authorizeUrl(opts: { redirectUri: string; state: string; challenge: string }): string {
  const url = new URL(`${AUTH_BASE}/v2/auth/authorize/`);
  // `client_key`, not `client_id` — TikTok's name for it, and a mismatch here
  // fails with an unhelpful generic error.
  url.searchParams.set("client_key", clientKey);
  url.searchParams.set("scope", TIKTOK_SCOPES.join(","));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", opts.redirectUri);
  url.searchParams.set("state", opts.state);
  url.searchParams.set("code_challenge", opts.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  refresh_expires_in?: number;
  scope?: string;
  open_id?: string;
  error?: string;
  error_description?: string;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE}/v2/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, ...body }),
    signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
    cache: "no-store",
  });
  const text = await res.text();
  let parsed: TokenResponse;
  try {
    parsed = JSON.parse(text) as TokenResponse;
  } catch {
    throw new Error(`TikTok token request returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  // TikTok answers some failures with HTTP 200 and an `error` field, so the
  // status alone is not enough to call this a success.
  if (!res.ok || parsed.error) {
    throw new Error(
      `TikTok token request failed (${res.status}): ${parsed.error ?? ""} ${parsed.error_description ?? text.slice(0, 200)}`.trim()
    );
  }
  return parsed;
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

export interface ConnectedTikTok {
  openId: string;
  displayName: string | null;
  scopes: string;
  expiresAt: Date;
  connectedAt: Date;
}

export async function getConnectedAccount(): Promise<ConnectedTikTok | null> {
  const row = await prisma.tikTokAccount.findUnique({ where: { id: "default" } });
  if (!row) return null;
  return {
    openId: row.openId,
    displayName: row.displayName,
    scopes: row.scopes,
    expiresAt: row.expiresAt,
    connectedAt: row.connectedAt,
  };
}

export async function saveAccount(opts: {
  openId: string;
  displayName: string | null;
  token: TokenResponse;
  connectedBy: string;
}): Promise<void> {
  const data = {
    openId: opts.openId,
    displayName: opts.displayName,
    accessToken: crypto_.encrypt(opts.token.access_token),
    refreshToken: opts.token.refresh_token ? crypto_.encrypt(opts.token.refresh_token) : null,
    expiresAt: new Date(Date.now() + opts.token.expires_in * 1000),
    scopes: opts.token.scope ?? TIKTOK_SCOPES.join(","),
    connectedBy: opts.connectedBy,
  };
  await prisma.tikTokAccount.upsert({
    where: { id: "default" },
    create: { id: "default", ...data },
    update: data,
  });
}

export async function disconnectAccount(): Promise<void> {
  await prisma.tikTokAccount.deleteMany({ where: { id: "default" } });
}

type TokenResult = { ok: true; token: string } | { ok: false; error: string };

/**
 * A usable access token, refreshed if it is close to expiring.
 *
 * TikTok's access tokens are short-lived (hours) while the refresh token lasts
 * a year, so for a job that runs once a day this path refreshes nearly every
 * time. TikTok rotates the refresh token on each use, so the response is
 * written back before it is used — dropping that write strands the account.
 */
async function accessToken(): Promise<TokenResult> {
  const row = await prisma.tikTokAccount.findUnique({ where: { id: "default" } });
  if (!row) return { ok: false, error: "No TikTok account is connected." };

  if (row.expiresAt.getTime() - Date.now() > REFRESH_MARGIN_MS) {
    const token = crypto_.decrypt(row.accessToken);
    if (token) return { ok: true, token };
    return { ok: false, error: "Stored TikTok credentials could not be read. Reconnect the account." };
  }

  const refresh = row.refreshToken ? crypto_.decrypt(row.refreshToken) : null;
  if (!refresh) {
    return { ok: false, error: "The TikTok grant expired and there is no refresh token. Reconnect the account." };
  }

  try {
    const next = await tokenRequest({ grant_type: "refresh_token", refresh_token: refresh });
    await prisma.tikTokAccount.update({
      where: { id: "default" },
      data: {
        accessToken: crypto_.encrypt(next.access_token),
        // Only overwrite when TikTok sends a new one; a missing field must not
        // wipe the working token we already hold.
        ...(next.refresh_token ? { refreshToken: crypto_.encrypt(next.refresh_token) } : {}),
        expiresAt: new Date(Date.now() + next.expires_in * 1000),
        ...(next.scope ? { scopes: next.scope } : {}),
      },
    });
    return { ok: true, token: next.access_token };
  } catch (e) {
    return { ok: false, error: `Could not refresh the TikTok grant: ${String(e)}. Reconnect the account.` };
  }
}

/** Display name for the connect confirmation. Never fatal — the push doesn't need it. */
export async function getCreatorName(token: string): Promise<{ openId: string; displayName: string | null } | null> {
  try {
    const res = await fetch(`${API_BASE}/v2/user/info/?fields=open_id,display_name`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
      cache: "no-store",
    });
    const body = (await res.json()) as {
      data?: { user?: { open_id?: string; display_name?: string } };
    };
    const user = body.data?.user;
    if (!user?.open_id) return null;
    return { openId: user.open_id, displayName: user.display_name ?? null };
  } catch {
    return null;
  }
}

// --- Pushing a video to the creator's drafts -------------------------------

export interface PushResult {
  ok: boolean;
  /** TikTok's handle for the upload, for a later status check. */
  publishId: string | null;
  error: string | null;
}

interface InboxInitResponse {
  data?: { publish_id?: string; upload_url?: string };
  error?: { code?: string; message?: string; log_id?: string };
}

/**
 * Put an MP4 into the connected creator's TikTok inbox as a draft.
 *
 * Two steps, both TikTok's design: init declares the size and gets a one-shot
 * upload URL, then the bytes go to that URL with a Content-Range. The file is
 * passed in as a Buffer rather than a URL because the PULL_FROM_URL source
 * requires the serving domain to be verified in TikTok's developer portal, and
 * our videos live on a Vercel Blob hostname we do not control. Sending the
 * bytes ourselves sidesteps that entirely.
 */
export async function pushVideo(video: Buffer): Promise<PushResult> {
  if (!tiktokConfigured()) {
    return { ok: false, publishId: null, error: "TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET are not set." };
  }
  if (video.length === 0) {
    return { ok: false, publishId: null, error: "The video file was empty." };
  }
  if (video.length > TIKTOK_SINGLE_CHUNK_LIMIT) {
    return {
      ok: false,
      publishId: null,
      error: `Video is ${(video.length / 1e6).toFixed(1)}MB; this uploads in one chunk and TikTok caps a chunk at 64MB.`,
    };
  }

  const auth = await accessToken();
  if (!auth.ok) return { ok: false, publishId: null, error: auth.error };

  let init: InboxInitResponse;
  let initStatus: number;
  try {
    const res = await fetch(`${API_BASE}/v2/post/publish/inbox/video/init/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        source_info: {
          source: "FILE_UPLOAD",
          video_size: video.length,
          // One chunk: the whole file. See TIKTOK_SINGLE_CHUNK_LIMIT.
          chunk_size: video.length,
          total_chunk_count: 1,
        },
      }),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
      cache: "no-store",
    });
    initStatus = res.status;
    init = (await res.json()) as InboxInitResponse;
  } catch (e) {
    return { ok: false, publishId: null, error: `TikTok upload init failed: ${String(e).slice(0, 200)}` };
  }

  // TikTok returns error.code === "ok" on success, so a present `error` object
  // is not itself a failure — the code is what decides.
  const code = init.error?.code;
  const uploadUrl = init.data?.upload_url;
  const publishId = init.data?.publish_id ?? null;
  if (!uploadUrl) {
    const detail = init.error?.message || `HTTP ${initStatus}`;
    return {
      ok: false,
      publishId,
      error: `TikTok refused the upload${code && code !== "ok" ? ` (${code})` : ""}: ${detail}`,
    };
  }

  try {
    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(video.length),
        // Inclusive byte range, then the total — TikTok rejects the upload
        // without it even when there is only one chunk.
        "Content-Range": `bytes 0-${video.length - 1}/${video.length}`,
      },
      body: new Uint8Array(video),
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!put.ok) {
      const text = await put.text().catch(() => "");
      return { ok: false, publishId, error: `TikTok rejected the file (${put.status}): ${text.slice(0, 200)}` };
    }
  } catch (e) {
    return { ok: false, publishId, error: `Sending the file to TikTok failed: ${String(e).slice(0, 200)}` };
  }

  return { ok: true, publishId, error: null };
}

export interface PublishStatus {
  status: string | null;
  error: string | null;
}

/**
 * Where an upload got to. TikTok processes asynchronously, so a successful
 * push only means the bytes arrived; this says whether the draft actually
 * landed in the inbox.
 */
export async function fetchStatus(publishId: string): Promise<PublishStatus> {
  const auth = await accessToken();
  if (!auth.ok) return { status: null, error: auth.error };
  try {
    const res = await fetch(`${API_BASE}/v2/post/publish/status/fetch/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({ publish_id: publishId }),
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
      cache: "no-store",
    });
    const body = (await res.json()) as {
      data?: { status?: string; fail_reason?: string };
      error?: { code?: string; message?: string };
    };
    if (body.error?.code && body.error.code !== "ok") {
      return { status: null, error: body.error.message ?? body.error.code };
    }
    return { status: body.data?.status ?? null, error: body.data?.fail_reason ?? null };
  } catch (e) {
    return { status: null, error: `Could not read the upload status: ${String(e).slice(0, 200)}` };
  }
}
