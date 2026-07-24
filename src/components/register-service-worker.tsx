"use client";

import { useEffect } from "react";
import { resyncPush } from "@/lib/push-client";

// Registers the service worker on load so the app is installable and can
// receive web push. Registration is idempotent and safe to run every visit.
// After registering, re-sync the push subscription so a subscription the server
// pruned (e.g. after the browser rotated the endpoint on an SW update) is
// silently restored for users who already granted notification permission.
export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => resyncPush())
      .catch(() => {});
  }, []);
  return null;
}
