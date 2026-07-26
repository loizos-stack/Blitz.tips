// Browser-side Web Push helpers, shared by the notification bell and the
// notification settings page. All functions are no-ops / false when the browser
// doesn't support push.

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    return Boolean(await reg?.pushManager.getSubscription());
  } catch {
    return false;
  }
}

/** Register the SW, request permission, subscribe, and persist. Returns success. */
export async function subscribePush(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return false;
    const { publicKey } = await fetch("/api/push/subscribe").then((r) => r.json());
    if (!publicKey) return false;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub),
    });
    await fetch("/api/notifications/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notifyPush: true }),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Self-heal push on load: if the user has already granted notification
 * permission, make sure a live subscription exists and the server knows about
 * it. This recovers subscriptions the server pruned after a 410 (e.g. when the
 * browser rotated the endpoint on a service-worker update) without prompting.
 * No-op when push is unsupported/unconfigured or permission isn't granted, so
 * it never nags a user who never opted in or who turned push off.
 */
export async function resyncPush(): Promise<void> {
  if (!pushSupported()) return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const { publicKey } = await fetch("/api/push/subscribe").then((r) => r.json());
    if (!publicKey) return;
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub),
    });
  } catch {
    // ignore — the settings toggle remains the manual fallback
  }
}

/** Remove the local subscription and tell the server to drop it. */
export async function unsubscribePush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
  } catch {
    // ignore
  }
}
