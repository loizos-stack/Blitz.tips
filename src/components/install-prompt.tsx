"use client";

import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";

const DISMISS_KEY = "blitz-install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// A dismissible prompt to install Blitz.tips to the home screen. On Chromium
// (Android/desktop) it uses the native install flow; on iOS Safari it shows the
// manual "Add to Home Screen" steps, since iOS has no install event.
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS Safari: no beforeinstallprompt — offer the manual steps. Deferred so
    // the state update doesn't run synchronously inside the effect.
    const ua = window.navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|chrome|android/i.test(ua);
    const iosTimer =
      isIos && isSafari
        ? setTimeout(() => {
            setShowIos(true);
            setHidden(false);
          }, 0)
        : undefined;

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  function dismiss() {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => undefined);
    setDeferred(null);
    dismiss();
  }

  if (hidden || (!deferred && !showIos)) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-xl border border-border bg-surface p-4 shadow-lg sm:left-auto sm:right-4">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 text-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- static app icon */}
        <img src="/icon-192.png" alt="" className="h-10 w-10 shrink-0 rounded-lg" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">Install Blitz.tips</p>
          {showIos ? (
            <p className="mt-1 text-xs text-muted">
              Tap the <Share className="inline h-3.5 w-3.5 align-text-bottom" /> Share button, then{" "}
              <span className="font-medium text-foreground">Add to Home Screen</span> to install and get
              instant pick alerts.
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs text-muted">
                Add it to your home screen for a full-screen app and instant pick notifications.
              </p>
              <button
                onClick={install}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:opacity-90"
              >
                <Download className="h-3.5 w-3.5" /> Install app
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
