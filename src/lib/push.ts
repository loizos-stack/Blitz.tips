import "server-only";
import webpush from "web-push";

// Web Push is optional: without VAPID keys configured, push sending is a no-op
// so the rest of the notification pipeline (in-app + email) still works.
const publicKey = process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
const subject = process.env.VAPID_SUBJECT ?? "mailto:support@blitz.tips";

let configured: boolean | null = null;

export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  if (publicKey && privateKey) {
    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      configured = true;
    } catch {
      configured = false;
    }
  } else {
    configured = false;
  }
  return configured;
}

/** The public VAPID key clients need to subscribe. Empty when push is unconfigured. */
export function vapidPublicKey(): string {
  return publicKey;
}

export interface PushRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Send one push message. Returns `gone: true` when the subscription is dead
 * (404/410) so the caller can prune it. Never throws.
 */
export async function sendPush(sub: PushRecord, payload: unknown): Promise<{ gone: boolean }> {
  if (!pushConfigured()) return { gone: false };
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    );
    return { gone: false };
  } catch (e: unknown) {
    const status = (e as { statusCode?: number })?.statusCode;
    return { gone: status === 404 || status === 410 };
  }
}
