"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Info, Check, AlertCircle, Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime } from "@/lib/date-format";
import { fetchJson } from "@/lib/fetch-json";

const CAPTION_LIMIT = 1024;
const TEXT_LIMIT = 4096;

interface Broadcast {
  id: string;
  chatId: string;
  chatTitle: string | null;
  text: string;
  asset: string | null;
  messageId: string | null;
  ok: boolean;
  error: string | null;
  sentByEmail: string;
  createdAt: string;
}

interface SpendEntry {
  id: string;
  platform: string;
  campaign: string;
  spentOn: string;
  spendCents: number;
  currency: string;
  impressions: number | null;
  clicks: number | null;
  notes: string | null;
}

interface Props {
  configured: boolean;
  assets: string[];
  broadcasts: Broadcast[];
  spend: SpendEntry[];
}

function money(cents: number, currency: string): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency });
}

export function TelegramManager({ configured, assets, broadcasts, spend }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"broadcast" | "spend">("broadcast");

  return (
    <div className="flex flex-col gap-6">
      <ApiNote />

      <div className="flex gap-2">
        {(["broadcast", "spend"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium",
              tab === t ? "border-accent bg-accent/10 text-accent" : "border-border text-muted"
            )}
          >
            {t === "broadcast" ? "Channel broadcast" : "Ad spend ledger"}
          </button>
        ))}
      </div>

      {tab === "broadcast" ? (
        <BroadcastPanel
          configured={configured}
          assets={assets}
          broadcasts={broadcasts}
          onSent={() => router.refresh()}
        />
      ) : (
        <SpendPanel spend={spend} onChanged={() => router.refresh()} />
      )}
    </div>
  );
}

/**
 * The reason this tab isn't a copy of the Ads tab. Stated up front because
 * "where's the campaign builder" is the first question anyone will have.
 */
function ApiNote() {
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-surface-raised p-4 text-sm">
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
      <div>
        <p className="font-semibold">Telegram has no ads API.</p>
        <p className="mt-1 text-muted">
          <code>ads.telegram.org</code>{" "}is a web dashboard only — there is no endpoint to create a
          campaign or read its stats, so this tab can&apos;t mirror the Meta one. What it does
          instead: <strong>broadcast</strong> to channels you own through the bot, which is the part
          that can be automated and reaches the same audience, and <strong>log</strong> what you
          spent on paid Telegram ads so it sits alongside everything else.
        </p>
        <p className="mt-2 text-muted">
          Telegram&apos;s own policy restricts gambling and betting promotion, and their sponsored
          messages have a minimum spend that changes periodically — check both before budgeting.
        </p>
      </div>
    </div>
  );
}

function BroadcastPanel({
  configured,
  assets,
  broadcasts,
  onSent,
}: {
  configured: boolean;
  assets: string[];
  broadcasts: Broadcast[];
  onSent: () => void;
}) {
  const [chatId, setChatId] = useState("");
  const [text, setText] = useState("");
  const [asset, setAsset] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const limit = asset ? CAPTION_LIMIT : TEXT_LIMIT;
  const over = text.length > limit;

  async function send() {
    // Posting to a channel notifies every subscriber and a bot can only delete
    // its own message for 48 hours. Confirm before, not after.
    const target = chatId.trim();
    if (
      !window.confirm(
        `Post to ${target}?\n\nThis publishes immediately and notifies every subscriber. A bot can only delete its own posts for 48 hours.`
      )
    )
      return;

    setBusy(true);
    setErr(null);
    setOk(null);
    const res = await fetchJson<{ chatTitle?: string }>("/api/admin/telegram/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: target, text, asset: asset || null }),
    });
    if (!res.ok) setErr(res.error);
    else {
      setOk(`Posted to ${res.data?.chatTitle ?? target}.`);
      setText("");
      onSent();
    }
    setBusy(false);
  }

  const field = "w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm";

  return (
    <div className="flex flex-col gap-6">
      {!configured && (
        <div className="rounded-xl border border-warning/40 bg-warning/5 p-4 text-sm">
          Set <code>TELEGRAM_BOT_TOKEN</code> and <code>TELEGRAM_BOT_USERNAME</code> to broadcast.
          The bot also has to be an administrator of the target channel with &quot;post
          messages&quot;.
        </div>
      )}
      {err && <div className="rounded-xl border border-danger/40 bg-danger/5 p-4 text-sm text-danger">{err}</div>}
      {ok && <div className="rounded-xl border border-success/40 bg-success/5 p-4 text-sm text-success">{ok}</div>}

      <div className="flex flex-col gap-4 rounded-2xl border border-border p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Channel</span>
            <input
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="@yourchannel"
              className={field}
            />
            <span className="mt-1 block text-xs text-muted">An @handle, or a numeric chat id.</span>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Attachment</span>
            <select value={asset} onChange={(e) => setAsset(e.target.value)} className={field}>
              <option value="">No media — text only</option>
              {assets.map((a) => (
                <option key={a} value={a}>
                  {a.replace("supercapper-", "")}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-muted">
              PNGs and MP4s from public/marketing.
            </span>
          </label>
        </div>

        <label className="text-sm">
          <span className="mb-1 flex items-center justify-between font-medium">
            <span>Post text {asset && "(caption)"}</span>
            <span className={cn("text-xs font-normal", over ? "text-danger" : "text-muted")}>
              {text.length} / {limit}
            </span>
          </span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} className={field} />
          {asset && (
            <span className="mt-1 block text-xs text-muted">
              Telegram caps a media caption at {CAPTION_LIMIT} characters against {TEXT_LIMIT} for a
              plain post — over the limit it refuses the whole thing.
            </span>
          )}
        </label>

        <button
          onClick={send}
          disabled={busy || !configured || !chatId.trim() || !text.trim() || over}
          className="inline-flex w-fit items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {busy ? "Posting…" : "Post to channel"}
        </button>
      </div>

      <div>
        <h3 className="mb-3 font-semibold">Recent broadcasts</h3>
        {broadcasts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
            Nothing sent yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {broadcasts.map((b) => (
              <div key={b.id} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {b.ok ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-danger" />
                    )}
                    {b.chatTitle ?? b.chatId}
                    {b.asset && (
                      <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs text-muted">
                        {b.asset.replace("supercapper-", "")}
                      </span>
                    )}
                  </p>
                  <span className="text-xs text-muted">
                    {formatDateTime(b.createdAt)} · {b.sentByEmail}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted">{b.text}</p>
                {b.error && (
                  <p className="mt-2 rounded-lg bg-danger/10 p-2 text-xs text-danger">{b.error}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SpendPanel({ spend, onChanged }: { spend: SpendEntry[]; onChanged: () => void }) {
  const [platform, setPlatform] = useState("Telegram Ads");
  const [campaign, setCampaign] = useState("");
  const [spentOn, setSpentOn] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [impressions, setImpressions] = useState("");
  const [clicks, setClicks] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function add() {
    setBusy(true);
    setErr(null);
    const res = await fetchJson("/api/admin/telegram/spend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform,
        campaign,
        spentOn,
        spend: Number(amount),
        currency,
        impressions,
        clicks,
        notes,
      }),
    });
    if (!res.ok) setErr(res.error);
    else {
      setCampaign("");
      setAmount("");
      setImpressions("");
      setClicks("");
      setNotes("");
      setShowForm(false);
      onChanged();
    }
    setBusy(false);
  }

  async function remove(id: string, label: string) {
    if (!window.confirm(`Delete the ledger row for "${label}"?\n\nThis is the only record of that spend.`)) return;
    await fetch(`/api/admin/telegram/spend/${id}`, { method: "DELETE" });
    onChanged();
  }

  // Totalled per currency rather than summed blindly — mixing GBP and USD into
  // one number would be a wrong number, not a rounded one.
  const totals = spend.reduce<Record<string, number>>((acc, s) => {
    acc[s.currency] = (acc[s.currency] ?? 0) + s.spendCents;
    return acc;
  }, {});

  const field = "w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4">
          {Object.entries(totals).length === 0 ? (
            <p className="text-sm text-muted">No spend logged.</p>
          ) : (
            Object.entries(totals).map(([cur, cents]) => (
              <div key={cur} className="rounded-xl border border-border px-4 py-2">
                <p className="text-xs text-muted">Total {cur}</p>
                <p className="text-lg font-bold">{money(cents, cur)}</p>
              </div>
            ))
          )}
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" /> {showForm ? "Close" : "Log spend"}
        </button>
      </div>

      {err && <div className="rounded-xl border border-danger/40 bg-danger/5 p-4 text-sm text-danger">{err}</div>}

      {showForm && (
        <div className="grid gap-4 rounded-2xl border border-border p-5 md:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Platform</span>
            <input value={platform} onChange={(e) => setPlatform(e.target.value)} className={field} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Campaign</span>
            <input value={campaign} onChange={(e) => setCampaign(e.target.value)} className={field} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Date</span>
            <input type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} className={field} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Spend</span>
            <input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={field} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Currency</span>
            <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} className={field} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Impressions</span>
            <input type="number" min={0} value={impressions} onChange={(e) => setImpressions(e.target.value)} className={field} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Clicks</span>
            <input type="number" min={0} value={clicks} onChange={(e) => setClicks(e.target.value)} className={field} />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block font-medium">Notes</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={field} />
          </label>
          <button
            onClick={add}
            disabled={busy || !campaign.trim() || amount === ""}
            className="self-end rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      )}

      {spend.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-raised text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Platform</th>
                <th className="px-4 py-2.5">Campaign</th>
                <th className="px-4 py-2.5 text-right">Spend</th>
                <th className="px-4 py-2.5 text-right">Impr.</th>
                <th className="px-4 py-2.5 text-right">Clicks</th>
                <th className="px-4 py-2.5 text-right">CPC</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {spend.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-2.5">{formatDate(s.spentOn)}</td>
                  <td className="px-4 py-2.5">{s.platform}</td>
                  <td className="px-4 py-2.5">
                    {s.campaign}
                    {s.notes && <span className="block text-xs text-muted">{s.notes}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold">{money(s.spendCents, s.currency)}</td>
                  <td className="px-4 py-2.5 text-right text-muted">
                    {s.impressions?.toLocaleString("en-US") ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted">
                    {s.clicks?.toLocaleString("en-US") ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted">
                    {s.clicks ? money(Math.round(s.spendCents / s.clicks), s.currency) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => remove(s.id, s.campaign)}
                      className="text-muted hover:text-danger"
                      aria-label={`Delete ${s.campaign}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
