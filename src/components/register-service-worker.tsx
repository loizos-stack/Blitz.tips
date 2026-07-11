"use client";

import { useEffect } from "react";

// Registers the service worker on load so the app is installable and can
// receive web push. Registration is idempotent and safe to run every visit.
export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
