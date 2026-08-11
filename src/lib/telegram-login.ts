import "server-only";
import { createHash, createHmac, timingSafeEqual } from "crypto";

/**
 * Telegram Login Widget verification.
 *
 * The widget hands the browser a signed payload and the browser posts it to us.
 * Everything in it is attacker-controlled until the signature checks out, so
 * nothing here trusts a field before `verifyTelegramAuth` has returned.
 *
 * The scheme (per Telegram's docs): build a newline-joined `key=value` string
 * from every field except `hash`, sorted by key; the HMAC-SHA256 of that string
 * — keyed by SHA256 of the bot token, not the token itself — must equal `hash`.
 *
 * Because the payload is self-authenticating, the signup flow can re-verify the
 * same payload on a later request instead of holding server-side state between
 * the widget callback and the form submit. `MAX_AUTH_AGE_MS` is what stops that
 * from becoming an unbounded replay window.
 */
export interface TelegramAuthPayload {
  id: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number | string;
  hash: string;
  [key: string]: unknown;
}

export interface TelegramIdentity {
  /** Telegram's numeric user id, as a string. Doubles as the private-chat id. */
  telegramId: string;
  username: string | null;
  name: string | null;
  photoUrl: string | null;
}

/**
 * How long a widget payload stays usable. Telegram's own sample allows a day,
 * which is far longer than any legitimate flow needs: the signup form is filled
 * in immediately after the popup closes. Fifteen minutes leaves room for a slow
 * form-fill while keeping a captured payload from being replayed later.
 */
export const MAX_AUTH_AGE_MS = 15 * 60 * 1000;

const botToken = process.env.TELEGRAM_BOT_TOKEN ?? "";
const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? "";

/** Both are required: the token signs the payload, the username renders the widget. */
export function telegramLoginConfigured(): boolean {
  return botToken.length > 0 && botUsername.length > 0;
}

export function telegramBotUsername(): string {
  return botUsername.replace(/^@/, "");
}

/**
 * Only the fields Telegram signs take part in the check string. An attacker who
 * appends an extra key would otherwise change the string we hash and break
 * verification of an otherwise genuine payload — and, worse, a caller reading
 * that extra key would be reading unsigned data.
 */
const SIGNED_FIELDS = ["auth_date", "first_name", "id", "last_name", "photo_url", "username"] as const;

function dataCheckString(payload: Record<string, unknown>): string {
  return SIGNED_FIELDS.filter((k) => payload[k] !== undefined && payload[k] !== null)
    .map((k) => `${k}=${String(payload[k])}`)
    .join("\n");
}

function safeEqualHex(a: string, b: string): boolean {
  // Both must be the same length before timingSafeEqual will look at them, and
  // a non-hex string would decode to a shorter buffer and throw.
  if (!/^[0-9a-f]{64}$/i.test(a) || !/^[0-9a-f]{64}$/i.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

/**
 * Returns the verified identity, or null if the payload is forged, tampered
 * with, stale, or malformed. Callers must treat null as "no identity at all"
 * rather than falling back to any field on the payload.
 */
export function verifyTelegramAuth(payload: unknown, now: number = Date.now()): TelegramIdentity | null {
  if (!telegramLoginConfigured()) return null;
  if (typeof payload !== "object" || payload === null) return null;

  const data = payload as TelegramAuthPayload;
  if (typeof data.hash !== "string" || data.id === undefined || data.auth_date === undefined) return null;

  const authDate = Number(data.auth_date);
  if (!Number.isFinite(authDate)) return null;

  // A payload dated in the future is either a clock problem or a forgery
  // attempt; either way it isn't something to sign someone in with. A little
  // slack absorbs ordinary clock skew between Telegram and us.
  const ageMs = now - authDate * 1000;
  if (ageMs > MAX_AUTH_AGE_MS || ageMs < -60_000) return null;

  const secret = createHash("sha256").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(dataCheckString(data)).digest("hex");
  if (!safeEqualHex(expected, data.hash)) return null;

  const id = String(data.id).trim();
  if (!/^\d{1,20}$/.test(id)) return null;

  const name = [data.first_name, data.last_name]
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .join(" ")
    .trim();

  return {
    telegramId: id,
    username: typeof data.username === "string" && data.username.length > 0 ? data.username : null,
    name: name.length > 0 ? name.slice(0, 60) : null,
    photoUrl: safePhotoUrl(data.photo_url),
  };
}

/**
 * Telegram serves widget avatars from t.me. Pinning the host matters twice
 * over: the value lands in `User.image`, and next/image refuses any host absent
 * from `images.remotePatterns` — so an unexpected host would render a broken
 * avatar rather than fail loudly.
 */
function safePhotoUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    const url = new URL(value);
    const allowed = url.protocol === "https:" && (url.hostname === "t.me" || url.hostname.endsWith(".t.me"));
    return allowed ? url.toString() : null;
  } catch {
    return null;
  }
}
