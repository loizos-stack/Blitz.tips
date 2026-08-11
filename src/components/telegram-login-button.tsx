"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { fetchJson } from "@/lib/fetch-json";

/**
 * "Log in with Telegram", using Telegram's own widget.
 *
 * The widget must be Telegram's: it is an iframe on their origin, so only they
 * can see the user's Telegram session, and the payload it returns is signed
 * with our bot token. We render the script tag and wait.
 *
 * One callback covers both sign-in and sign-up, because the widget cannot tell
 * them apart — so the payload goes to /check first. A returning user is signed
 * straight in; a new one is handed to /signup/telegram, which collects the
 * email Telegram doesn't provide.
 *
 * Nothing renders unless the bot username is configured, and the widget itself
 * only appears once Telegram's script has run — a misconfigured domain in
 * BotFather leaves an empty box rather than a broken button.
 */
const SCRIPT_SRC = "https://telegram.org/js/telegram-widget.js?22";

/** Carries the verified payload to the signup page without putting it in a URL. */
export const TELEGRAM_SIGNUP_KEY = "telegram_signup_payload";

declare global {
  interface Window {
    onTelegramAuth?: (user: unknown) => void;
  }
}

export function TelegramLoginButton({
  botUsername,
  callbackUrl = "/welcome",
  onError,
}: {
  botUsername: string;
  callbackUrl?: string;
  onError?: (message: string) => void;
}) {
  const router = useRouter();
  const holder = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const onAuth = async (user: unknown) => {
    setBusy(true);
    const check = await fetchJson<{ status: "linked" | "new" }>("/api/telegram-login/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user),
    });

    if (!check.ok || !check.data) {
      setBusy(false);
      onError?.(check.error ?? "Telegram sign-in failed. Please try again.");
      return;
    }

    if (check.data.status === "linked") {
      const res = await signIn("telegram", { payload: JSON.stringify(user), redirect: false });
      setBusy(false);
      if (res?.error) {
        onError?.("Telegram sign-in failed. Please try again.");
        return;
      }
      router.push(callbackUrl);
      router.refresh();
      return;
    }

    // New account. sessionStorage rather than a query string: the payload is
    // long, and a signed credential does not belong in a URL that lands in
    // history and server logs.
    try {
      sessionStorage.setItem(TELEGRAM_SIGNUP_KEY, JSON.stringify(user));
    } catch {
      setBusy(false);
      onError?.("Your browser blocked storage needed to finish signing up.");
      return;
    }
    router.push("/signup/telegram");
  };

  // Latest-value ref: Telegram calls one global callback, and the script below
  // is mounted once, so the callback has to reach the current render's closure
  // rather than the one captured when the script was appended.
  const handler = useRef(onAuth);
  useEffect(() => {
    handler.current = onAuth;
  });

  useEffect(() => {
    const node = holder.current;
    if (!node || node.childElementCount > 0) return;

    window.onTelegramAuth = (user: unknown) => handler.current(user);

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-userpic", "false");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    node.appendChild(script);

    return () => {
      delete window.onTelegramAuth;
    };
  }, [botUsername]);

  return (
    <div className="flex flex-col items-center">
      <div ref={holder} aria-busy={busy} className={busy ? "pointer-events-none opacity-60" : undefined} />
      {busy && <p className="mt-2 text-xs text-muted">Signing you in…</p>}
    </div>
  );
}
