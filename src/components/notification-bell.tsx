"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { Bell, Check } from "lucide-react";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  url: string | null;
  readAt: string | null;
  createdAt: string;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [emailOn, setEmailOn] = useState(true);
  const [pushAvailable, setPushAvailable] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications").then((r) => r.json()).catch(() => null);
    if (res) {
      setItems(res.notifications ?? []);
      setUnread(res.unread ?? 0);
    }
  }, []);

  // Poll for new notifications; the browser cache keeps this cheap.
  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  // One-time capability + preference probe.
  useEffect(() => {
    fetch("/api/notifications/preferences")
      .then((r) => r.json())
      .then((p) => setEmailOn(p.notifyEmail !== false))
      .catch(() => {});
    const supported =
      typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
    if (!supported) return;
    fetch("/api/push/subscribe")
      .then((r) => r.json())
      .then((p) => setPushAvailable(Boolean(p.configured)))
      .catch(() => {});
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setPushOn(Boolean(sub)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function markAllRead() {
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
  }

  async function toggleEmail(next: boolean) {
    setEmailOn(next);
    await fetch("/api/notifications/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notifyEmail: next }),
    }).catch(() => {});
  }

  async function enablePush() {
    setPushBusy(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
      const { publicKey } = await fetch("/api/push/subscribe").then((r) => r.json());
      if (!publicKey) return;
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
      setPushOn(true);
    } catch {
      // permission denied or unsupported — leave the toggle off
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    setPushBusy(true);
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
      setPushOn(false);
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-white/90 hover:bg-white/10 hover:text-white"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-surface text-foreground shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-medium text-accent hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted">You&apos;re all caught up.</p>
            ) : (
              items.map((n) => {
                const inner = (
                  <div
                    className={`flex gap-2 px-4 py-3 ${n.readAt ? "" : "bg-accent/5"} hover:bg-surface-raised`}
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-accent"}`}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{n.title}</p>
                      <p className="line-clamp-2 text-xs text-muted">{n.body}</p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {formatDistanceToNowStrict(new Date(n.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
                return n.url ? (
                  <Link key={n.id} href={n.url} onClick={() => setOpen(false)}>
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id}>{inner}</div>
                );
              })
            )}
          </div>

          <div className="space-y-2 border-t border-border px-4 py-3">
            <label className="flex items-center justify-between text-sm">
              <span className="text-muted">Email me new picks</span>
              <input
                type="checkbox"
                checked={emailOn}
                onChange={(e) => toggleEmail(e.target.checked)}
                className="h-4 w-4 accent-[var(--accent,#16a34a)]"
              />
            </label>
            {pushAvailable && (
              <label className="flex items-center justify-between text-sm">
                <span className="text-muted">Push on this device</span>
                <input
                  type="checkbox"
                  checked={pushOn}
                  disabled={pushBusy}
                  onChange={(e) => (e.target.checked ? enablePush() : disablePush())}
                  className="h-4 w-4 accent-[var(--accent,#16a34a)]"
                />
              </label>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
