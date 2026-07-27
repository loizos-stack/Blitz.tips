"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import { SupercapperLogo } from "@/components/contest/supercapper-logo";

/**
 * First-visit popups: a cross-promo for whichever product you're *not* on, and
 * the cookie prompt where it's required.
 *
 * Never both at once. Consent comes first — it's a legal prompt, and stacking a
 * marketing modal on top of it makes the consent choice look like part of an
 * ad, which is exactly what regulators object to. The promo waits until consent
 * has been answered.
 *
 * Dismissal is permanent per popup, kept in localStorage. Someone who closed it
 * has told you their answer; asking again on every visit is how a promo becomes
 * a reason to leave.
 */

const KEY_COOKIES = "blitz.cookieConsent.v1";
const KEY_PROMO_CONTEST = "blitz.promo.contest.v1";
const KEY_PROMO_SITE = "blitz.promo.site.v1";

// Long enough that it doesn't fight the page for attention while it's still
// painting, short enough to land before a skim-reader leaves.
const PROMO_DELAY_MS = 2500;

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) !== null;
  } catch {
    // Private mode / storage disabled: treat as not-yet-dismissed but never
    // throw. A popup that crashes the page is worse than one shown twice.
    return false;
  }
}

function writeFlag(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — the popup just reappears next visit */
  }
}

export function SitePopups({ cookieConsentRequired }: { cookieConsentRequired: boolean }) {
  const pathname = usePathname() ?? "/";
  const onContest = pathname === "/supercapper" || pathname.startsWith("/supercapper/");

  const [needsCookies, setNeedsCookies] = useState(false);
  const [showPromo, setShowPromo] = useState(false);
  // Null until the first client render, so nothing renders during hydration.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Deferred so the effect body doesn't set state synchronously — localStorage
    // is client-only, so this can't be seeded during render either.
    const t = setTimeout(() => {
      setReady(true);
      if (cookieConsentRequired && !readFlag(KEY_COOKIES)) setNeedsCookies(true);
    }, 0);
    return () => clearTimeout(t);
  }, [cookieConsentRequired]);

  // The promo is held back until consent is settled.
  useEffect(() => {
    if (!ready || needsCookies) return;
    const key = onContest ? KEY_PROMO_SITE : KEY_PROMO_CONTEST;
    if (readFlag(key)) return;
    const t = setTimeout(() => setShowPromo(true), PROMO_DELAY_MS);
    return () => clearTimeout(t);
  }, [ready, needsCookies, onContest]);

  function answerCookies(value: "accepted" | "declined") {
    writeFlag(KEY_COOKIES, value);
    setNeedsCookies(false);
  }

  function dismissPromo() {
    writeFlag(onContest ? KEY_PROMO_SITE : KEY_PROMO_CONTEST, "dismissed");
    setShowPromo(false);
  }

  if (!ready) return null;

  if (needsCookies) {
    return (
      <div
        role="dialog"
        aria-modal="false"
        aria-label="Cookie preferences"
        className="fixed inset-x-0 bottom-0 z-[80] border-t border-white/10 bg-[#0b0f14] p-4 text-white shadow-2xl"
      >
        <div className="container-page flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-white/80">
            We use cookies to keep you signed in and to measure how the site is used. You can accept
            or decline analytics — declining keeps only what the site needs to work.{" "}
            <Link href="/privacy" className="font-semibold text-[#22c55e] hover:underline">
              Privacy Policy
            </Link>
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => answerCookies("declined")}
              className="rounded-lg border border-white/25 px-4 py-2 text-sm font-semibold text-white hover:border-white/50"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => answerCookies("accepted")}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!showPromo) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={dismissPromo}
        className="absolute inset-0 cursor-default bg-black/50"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={onContest ? "Blitz.tips" : "Supercapper contest"}
        className={
          onContest
            ? "relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface p-6 text-center shadow-2xl"
            : "relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0b0f14] p-6 text-center text-white shadow-2xl"
        }
      >
        <button
          type="button"
          onClick={dismissPromo}
          aria-label="Close"
          className={
            onContest
              ? "absolute right-3 top-3 text-muted hover:text-foreground"
              : "absolute right-3 top-3 text-white/60 hover:text-white"
          }
        >
          <X className="h-5 w-5" />
        </button>

        {onContest ? (
          <>
            <span className="mx-auto flex items-center justify-center gap-2 font-display text-2xl font-bold tracking-tight">
              <Image src="/logo-mark.svg" alt="" width={32} height={32} className="h-8 w-8" />
              <span>
                Blitz<span className="text-accent">.tips</span>
              </span>
            </span>
            <p className="mt-4 text-lg font-semibold">Every pick tracked, graded, and ranked</p>
            <p className="mt-2 text-sm text-muted">
              The contest is one part of it. Blitz.tips is a marketplace of handicappers with
              records you can actually audit — no screenshots, no deleted losers.
            </p>
            <Link
              href="/handicappers"
              onClick={dismissPromo}
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90"
            >
              Browse handicappers <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        ) : (
          <>
            <div className="flex justify-center">
              <SupercapperLogo withContest onDark className="text-2xl" />
            </div>
            <p className="mt-4 text-2xl font-extrabold text-[#eab308]">$10,000 guaranteed</p>
            <p className="mt-2 text-sm text-white/70">
              Free to enter. Post your picks, every one graded in public, best ROI takes the biggest
              slice. No buy-in, no catch.
            </p>
            <Link
              href="/supercapper"
              onClick={dismissPromo}
              className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90"
            >
              See the contest <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
