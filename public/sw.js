// Blitz.tips web-push service worker. Shows notifications pushed from the
// server and focuses/opens the app when one is clicked.

// Take control immediately on update so the newest SW handles pushes.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// A pass-through fetch handler is required for the browser to treat the app as
// installable (Add to Home Screen). We don't cache — just let the network serve.
self.addEventListener("fetch", () => {});

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Re-subscribe and re-register with the server when the browser rotates or
// invalidates the push subscription (this fires on SW updates and spontaneous
// expiry). Without this, a rotated subscription dies silently and the server
// prunes it on the next 410 — so push stops until the user manually re-enables.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const res = await fetch("/api/push/subscribe");
        const { publicKey } = await res.json();
        if (!publicKey) return;
        const sub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub),
        });
      } catch {
        // best-effort — the client also re-syncs on next load
      }
    })()
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "Blitz.tips";
  const options = {
    body: data.body || "",
    icon: "/logo-mark.svg",
    badge: "/logo-mark.svg",
    data: { url: data.url || "/" },
    tag: data.tag || undefined,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
