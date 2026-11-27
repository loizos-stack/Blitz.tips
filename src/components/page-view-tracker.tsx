"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Tells the site a page was viewed.
 *
 * No cookie, no storage, nothing written to the device — the server works out
 * who is who from a daily-rotating digest it computes itself. That is what
 * keeps this outside the cookie consent gate, on the same footing as Vercel's
 * cookieless analytics and unlike Google Analytics, which is gated because it
 * writes `_ga`. See lib/analytics.ts.
 *
 * It fires on first load and on every client-side navigation, because in an
 * App Router site most page views never hit the server as a document request —
 * counting those alone would undercount every visitor who clicks more than
 * once.
 */
export function PageViewTracker() {
  const pathname = usePathname();
  // Guards against the double-invocation of effects in development, which
  // would otherwise count every view twice while testing.
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastSent.current === pathname) return;
    lastSent.current = pathname;

    const payload = JSON.stringify({
      path: pathname,
      // Only meaningful on the first page of a visit; after that it is our own
      // URL, which the server discards.
      referrer: document.referrer || null,
    });

    // sendBeacon survives the page being closed mid-navigation, which a plain
    // fetch does not. keepalive is the fallback for the same reason.
    try {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon?.("/api/track", blob)) return;
    } catch {
      // fall through
    }
    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
