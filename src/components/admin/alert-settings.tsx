"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, AlertCircle, Send, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/lib/fetch-json";

export interface AlertKindRow {
  key: string;
  label: string;
  description: string;
  channels: ("email" | "telegram")[];
}

/**
 * Who gets told when something happens on the site.
 *
 * The chat ID is asked for rather than discovered because a bot cannot list
 * the chats it is in — Telegram only tells it about a chat once someone has
 * spoken to it there. Hence the test button: it is the only way to find out
 * you got the number right short of waiting for a real signup, and finding out
 * that way means you already missed one.
 */
export function AlertSettings({
  kinds,
  chatId: initialChatId,
  telegramReady,
  botUsername,
  toggles: initialToggles,
  alertEmail,
}: {
  kinds: AlertKindRow[];
  chatId: string | null;
  telegramReady: boolean;
  /** Our own bot's @name, for the /id instructions. */
  botUsername: string;
  toggles: Record<string, boolean>;
  /** Where the email alerts land, for display only. */
  alertEmail: string;
}) {
  const router = useRouter();
  const [chatId, setChatId] = useState(initialChatId ?? "");
  const [toggles, setToggles] = useState(initialToggles);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function call(body: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    setNote(null);
    const res = await fetchJson<{ detail?: string }>("/api/admin/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(null);
    if (!res.ok) {
      setError(res.error ?? "That didn't work.");
      return false;
    }
    if (res.data?.detail) setNote(res.data.detail);
    router.refresh();
    return true;
  }

  async function toggle(key: string) {
    const next = !toggles[key];
    setToggles((t) => ({ ...t, [key]: next }));
    const ok = await call({ action: "toggle", key, value: next }, key);
    // Put it back if the server disagreed, rather than leaving the switch
    // showing a state nothing is in.
    if (!ok) setToggles((t) => ({ ...t, [key]: !next }));
  }

  return (
    <div className="card p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <Bell className="h-4 w-4" /> Alerts
      </h2>
      <p className="mt-1 text-sm text-muted">
        What the site tells you about as it happens. Email goes to{" "}
        <span className="font-medium">{alertEmail}</span>.
      </p>

      {/* Telegram destination */}
      <div className="mt-4 border-t border-border pt-4">
        <label className="text-sm font-medium">Telegram chat ID</label>
        {/* This used to point at @userinfobot. It gives you a correct number,
            and the number is only half the problem: our bot can only post
            where it is itself a member, so a perfectly valid ID still answers
            "chat not found". Asking our own bot proves both at once — if it
            replies, it can post there. */}
        <p className="mt-0.5 text-xs text-muted">
          Send <code className="font-medium">/id</code> to{" "}
          <span className="font-medium">{botUsername ? `@${botUsername}` : "the bot"}</span> and it
          replies with the ID of that chat. For a group, add the bot to the group first and send{" "}
          <code className="font-medium">/id</code> there — it also says the ID by itself when you add
          it. Group IDs start with a minus.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder="123456789"
            className="w-48 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={() => call({ action: "chatId", value: chatId }, "chatId")}
            disabled={busy !== null}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
          >
            {busy === "chatId" ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => call({ action: "test" }, "test")}
            disabled={busy !== null || !initialChatId}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:border-accent hover:text-accent disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5" /> Send a test
          </button>
        </div>
        {!telegramReady && (
          <p className="mt-2 flex items-start gap-2 text-xs text-muted">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <code>TELEGRAM_BOT_TOKEN</code> and <code>TELEGRAM_BOT_USERNAME</code> aren&apos;t set, so
            nothing will send until they are. Email alerts still work.
          </p>
        )}
        {/* Said out loud, because the empty box on its own said nothing: every
            Telegram alert is being dropped and the only hint was a greyed-out
            test button. */}
        {telegramReady && !initialChatId && (
          <p className="mt-2 flex items-start gap-2 text-xs text-danger">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            No chat ID saved, so <strong>every Telegram alert below is being dropped</strong> — signups
            included. Save one here and send a test. Email alerts are unaffected.
          </p>
        )}
      </div>

      {/* Per-event switches */}
      <div className="mt-4 border-t border-border pt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted">
              <th className="pb-2">Tell me when</th>
              <th className="w-24 pb-2 text-center">Email</th>
              <th className="w-24 pb-2 text-center">Telegram</th>
            </tr>
          </thead>
          <tbody>
            {kinds.map((k) => (
              <tr key={k.key} className="border-t border-border">
                <td className="py-2.5 pr-3">
                  <p className="font-medium">{k.label}</p>
                  <p className="text-xs text-muted">{k.description}</p>
                </td>
                {(["email", "telegram"] as const).map((channel) => {
                  const key = `alerts.${k.key}.${channel}`;
                  if (!k.channels.includes(channel)) {
                    return (
                      <td key={channel} className="py-2.5 text-center text-xs text-muted">
                        —
                      </td>
                    );
                  }
                  const on = toggles[key] !== false;
                  return (
                    <td key={channel} className="py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => toggle(key)}
                        disabled={busy !== null}
                        aria-pressed={on}
                        aria-label={`${k.label} by ${channel}`}
                        className={cn(
                          "inline-flex h-6 w-11 items-center rounded-full border transition disabled:opacity-60",
                          on ? "border-accent bg-accent/20" : "border-border bg-surface"
                        )}
                      >
                        <span
                          className={cn(
                            "h-4 w-4 rounded-full transition",
                            on ? "ml-6 bg-accent" : "ml-1 bg-muted"
                          )}
                        />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => call({ action: "preview" }, "preview")}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:border-accent hover:text-accent disabled:opacity-60"
        >
          <Bell className="h-3.5 w-3.5" />
          {busy === "preview" ? "Sending…" : "Send a real alert to both"}
        </button>
        {note && (
          <p className="flex items-center gap-1.5 text-sm text-accent">
            <Check className="h-4 w-4" /> {note}
          </p>
        )}
        {error && (
          <p className="flex items-start gap-1.5 text-sm text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </p>
        )}
      </div>

      <p className="mt-3 flex items-start gap-2 text-xs text-muted">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        A support ticket is Telegram-only here: the team already gets a full copy of the message by
        email, with reply-to set to the customer, so you can answer by replying to it.
      </p>
    </div>
  );
}
