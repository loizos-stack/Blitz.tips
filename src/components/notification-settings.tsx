"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, Bell, Send, MessageCircle } from "lucide-react";
import { pushSupported, isPushSubscribed, subscribePush, unsubscribePush } from "@/lib/push-client";

type Prefs = { email: boolean; push: boolean; telegram: boolean; discord: boolean };

async function savePref(pref: Partial<Prefs>) {
  const body: Record<string, boolean> = {};
  if (pref.email !== undefined) body.notifyEmail = pref.email;
  if (pref.push !== undefined) body.notifyPush = pref.push;
  if (pref.telegram !== undefined) body.notifyTelegram = pref.telegram;
  if (pref.discord !== undefined) body.notifyDiscord = pref.discord;
  await fetch("/api/notifications/preferences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

function Row({
  icon,
  title,
  desc,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 last:border-b-0">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted">{desc}</p>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className="h-5 w-5 accent-[var(--accent,#16a34a)] disabled:opacity-50"
      aria-label="Toggle"
    />
  );
}

export function NotificationSettings({
  initial,
  telegramLinked,
  discordLinked,
  telegramAvailable,
  discordAvailable,
  pushAvailable,
}: {
  initial: Prefs;
  telegramLinked: boolean;
  discordLinked: boolean;
  telegramAvailable: boolean;
  discordAvailable: boolean;
  pushAvailable: boolean;
}) {
  const params = useSearchParams();
  const [prefs, setPrefs] = useState<Prefs>(initial);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  // Determined in an effect: pushSupported() differs between server and client,
  // and branching render text on it directly would break hydration.
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    // Deferred so the effect doesn't set state synchronously.
    const t = setTimeout(() => {
      const ok = pushSupported();
      setSupported(ok);
      if (ok) isPushSubscribed().then(setPushOn);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  function set<K extends keyof Prefs>(key: K, value: boolean) {
    setPrefs((p) => ({ ...p, [key]: value }));
    savePref({ [key]: value } as Partial<Prefs>);
  }

  async function togglePush(next: boolean) {
    setPushBusy(true);
    try {
      if (next) {
        if (await subscribePush()) setPushOn(true);
      } else {
        await unsubscribePush();
        setPushOn(false);
        set("push", false);
      }
    } finally {
      setPushBusy(false);
    }
  }

  async function connectTelegram() {
    const res = await fetch("/api/telegram/link").then((r) => r.json());
    if (res?.url) window.open(res.url, "_blank", "noopener");
  }

  async function unlinkTelegram() {
    await fetch("/api/telegram/unlink", { method: "POST" });
    window.location.reload();
  }

  async function unlinkDiscord() {
    await fetch("/api/discord/unlink", { method: "POST" });
    window.location.reload();
  }

  const discordStatus = params.get("discord");

  return (
    <div className="space-y-4">
      {discordStatus === "connected" && (
        <p className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm text-accent">
          Discord connected — you&apos;ll get a DM on new picks.
        </p>
      )}
      {discordStatus === "error" && (
        <p className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-2 text-sm text-danger">
          Couldn&apos;t connect Discord. Please try again.
        </p>
      )}

      <div className="card p-0">
        <Row icon={<Mail className="h-4 w-4" />} title="Email" desc="A message to your inbox on each new pick.">
          <Toggle checked={prefs.email} onChange={(v) => set("email", v)} />
        </Row>

        <Row
          icon={<Bell className="h-4 w-4" />}
          title="Browser push"
          desc={
            !pushAvailable
              ? "Not available right now."
              : supported
                ? "Instant notification on this device."
                : "This browser doesn't support push."
          }
        >
          {pushAvailable && supported ? (
            <Toggle checked={pushOn} disabled={pushBusy} onChange={togglePush} />
          ) : (
            <span className="text-sm text-muted">—</span>
          )}
        </Row>

        <Row
          icon={<Send className="h-4 w-4" />}
          title="Telegram"
          desc={
            !telegramAvailable
              ? "Not available right now."
              : telegramLinked
                ? "Connected. We'll DM you on Telegram."
                : "Get a DM from our Telegram bot."
          }
        >
          {!telegramAvailable ? (
            <span className="text-sm text-muted">—</span>
          ) : telegramLinked ? (
            <div className="flex items-center gap-3">
              <Toggle checked={prefs.telegram} onChange={(v) => set("telegram", v)} />
              <button onClick={unlinkTelegram} className="text-sm text-muted hover:text-danger">
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={connectTelegram}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground hover:opacity-90"
            >
              Connect
            </button>
          )}
        </Row>

        <Row
          icon={<MessageCircle className="h-4 w-4" />}
          title="Discord"
          desc={
            !discordAvailable
              ? "Not available right now."
              : discordLinked
                ? "Connected. We'll DM you on Discord."
                : "Get a DM from our Discord bot. Keep DMs open so it can reach you."
          }
        >
          {!discordAvailable ? (
            <span className="text-sm text-muted">—</span>
          ) : discordLinked ? (
            <div className="flex items-center gap-3">
              <Toggle checked={prefs.discord} onChange={(v) => set("discord", v)} />
              <button onClick={unlinkDiscord} className="text-sm text-muted hover:text-danger">
                Disconnect
              </button>
            </div>
          ) : (
            <a
              href="/api/discord/authorize"
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground hover:opacity-90"
            >
              Connect
            </a>
          )}
        </Row>
      </div>

      <p className="text-xs text-muted">
        In-app notifications (the bell) are always on. Followers and subscribers both get notified of
        every new pick; premium picks are teased until you subscribe.
      </p>
    </div>
  );
}
