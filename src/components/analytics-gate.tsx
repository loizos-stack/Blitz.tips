"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import {
  CONSENT_EVENT,
  analyticsAllowed,
  readConsent,
  type ConsentValue,
} from "@/lib/cookie-consent";

const GA_ID = "G-Z43Z20YSYL";

/**
 * Loads Google Analytics only when it's allowed to run.
 *
 * GA is gated because it writes cookies (`_ga`), which is exactly what ePrivacy
 * requires opt-in for. Vercel's Web Analytics and Speed Insights stay outside
 * this gate deliberately: they're cookieless and store nothing on the device,
 * so consent isn't required for them and blocking them would cost the site its
 * basic traffic numbers for no compliance gain.
 *
 * Where consent is required, nothing loads until the visitor accepts —
 * including on the very first page view. That's the point: a consent prompt
 * that appears after the tracker has already fired isn't consent.
 */
export function AnalyticsGate({ consentRequired }: { consentRequired: boolean }) {
  const [consent, setConsent] = useState<ConsentValue | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Deferred so the effect body doesn't set state synchronously.
    const t = setTimeout(() => {
      setConsent(readConsent());
      setReady(true);
    }, 0);

    const onAnswer = (e: Event) => setConsent((e as CustomEvent<ConsentValue>).detail);
    window.addEventListener(CONSENT_EVENT, onAnswer);
    return () => {
      clearTimeout(t);
      window.removeEventListener(CONSENT_EVENT, onAnswer);
    };
  }, []);

  // Until the stored answer has been read, assume nothing. A flash of GA on
  // first paint would defeat the gate.
  if (!ready || !analyticsAllowed(consentRequired, consent)) return null;

  return (
    <>
      {/* afterInteractive so it never blocks first paint. */}
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  );
}
