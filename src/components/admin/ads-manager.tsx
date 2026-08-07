"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Megaphone, Plus, Play, Pause, ExternalLink, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/date-format";
import {
  CAMPAIGN_OBJECTIVES,
  CALL_TO_ACTIONS,
  DATE_PRESETS,
  type AccountMeta,
  type Ad,
  type AdInsights,
  type Campaign,
  type DatePreset,
} from "@/lib/meta-ads-shared";

interface Props {
  configured: boolean;
  canCreate: boolean;
  preset: DatePreset;
  account?: AccountMeta | null;
  totals?: AdInsights | null;
  campaigns?: Campaign[];
  adsByCampaign?: Record<string, Ad[]>;
  assets: string[];
  maxDailyBudget?: number;
  /** Headline/description seeded from the live contest row, not typed in here. */
  copyDefaults?: { headline: string; description: string } | null;
  loadError?: string | null;
}

const COUNTRY_PRESETS = [
  { label: "UK & Ireland", codes: ["GB", "IE"] },
  { label: "United States", codes: ["US"] },
  { label: "Canada", codes: ["CA"] },
  { label: "Australia & NZ", codes: ["AU", "NZ"] },
];

function money(n: number | null | undefined, currency = "USD"): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency, maximumFractionDigits: 2 });
}

function count(n: number | null | undefined): string {
  return n == null ? "—" : n.toLocaleString("en-US");
}

function statusTone(effective: string): string {
  if (effective === "ACTIVE") return "bg-success/10 text-success";
  if (effective === "DISAPPROVED" || effective === "WITH_ISSUES") return "bg-danger/10 text-danger";
  if (effective === "PENDING_REVIEW" || effective === "IN_PROCESS") return "bg-warning/10 text-warning";
  return "bg-surface-raised text-muted";
}

export function AdsManager({
  configured,
  canCreate,
  preset,
  account,
  totals,
  campaigns = [],
  adsByCampaign = {},
  assets,
  maxDailyBudget = 500,
  copyDefaults,
  loadError,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const currency = account?.currency ?? "USD";

  function setRange(value: string) {
    const next = new URLSearchParams(params.toString());
    next.set("range", value);
    router.push(`/admin/ads?${next}`);
  }

  async function toggle(id: string, current: string, label: string) {
    const next = current === "ACTIVE" ? "PAUSED" : "ACTIVE";
    if (next === "ACTIVE") {
      // Going live starts spending. Never on a single click.
      const ok = window.confirm(
        `Set "${label}" ACTIVE?\n\nThis starts spending real budget against the ad account immediately. Meta bills for delivery from the moment it goes live.`
      );
      if (!ok) return;
    }
    setBusy(id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/ads/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json();
      if (!res.ok) setError(json.error ?? "Status change failed");
      else {
        setNotice(`${label} is now ${next}.`);
        router.refresh();
      }
    } catch {
      setError("Couldn't reach the server");
    } finally {
      setBusy(null);
    }
  }

  if (!configured) {
    return (
      <div className="rounded-2xl border border-border p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Megaphone className="h-5 w-5" /> Meta Ads
        </h2>
        <p className="mt-2 text-sm text-muted">
          Not connected. Set <code>META_ADS_ACCESS_TOKEN</code> and <code>META_AD_ACCOUNT_ID</code>{" "}
          to read campaign performance, plus <code>META_PAGE_ID</code> to create ads.
        </p>
        <PolicyWarning />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PolicyWarning />

      {loadError && (
        <div className="rounded-xl border border-danger/40 bg-danger/5 p-4 text-sm text-danger">
          Meta wouldn&apos;t return campaigns: {loadError}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-danger/40 bg-danger/5 p-4 text-sm text-danger">{error}</div>
      )}
      {notice && (
        <div className="rounded-xl border border-success/40 bg-success/5 p-4 text-sm text-success">{notice}</div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Megaphone className="h-5 w-5" />
            {account ? account.name : "Ad account"}
          </h2>
          <p className="text-sm text-muted">
            {account?.accountStatus === 1 ? "Account active" : `Account status ${account?.accountStatus ?? "?"}`}
            {account?.amountSpent != null && ` · ${money(account.amountSpent, currency)} spent all time`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={preset}
            onChange={(e) => setRange(e.target.value)}
            className="rounded-full border border-border bg-transparent px-3 py-1.5 text-sm"
          >
            {DATE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          {canCreate && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white"
            >
              {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showForm ? "Close" : "New campaign"}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Spend" value={money(totals?.spend, currency)} />
        <Stat label="Impressions" value={count(totals?.impressions)} />
        <Stat label="Clicks" value={count(totals?.clicks)} />
        <Stat label="CTR" value={totals ? `${totals.ctr.toFixed(2)}%` : "—"} />
        <Stat label="CPC" value={money(totals?.cpc, currency)} />
      </div>

      {showForm && canCreate && (
        <CreateForm
          assets={assets}
          maxDailyBudget={maxDailyBudget}
          currency={currency}
          copyDefaults={copyDefaults}
          onDone={(msg) => {
            setShowForm(false);
            setNotice(msg);
            router.refresh();
          }}
        />
      )}

      {campaigns.length === 0 && !loadError ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
          No campaigns in this ad account yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {campaigns.map((c) => {
            const ads = adsByCampaign[c.id] ?? [];
            const rejected = ads.filter((a) => a.reviewFeedback);
            return (
              <div key={c.id} className="rounded-2xl border border-border">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {c.name}
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", statusTone(c.effectiveStatus))}>
                        {c.effectiveStatus}
                      </span>
                      {rejected.length > 0 && (
                        <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
                          {rejected.length} rejected
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted">
                      {c.objective.replace("OUTCOME_", "")} · created {formatDate(c.createdTime)}
                      {c.dailyBudget != null && ` · ${money(c.dailyBudget, currency)}/day`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden gap-5 text-right text-sm sm:flex">
                      <Metric label="Spend" value={money(c.insights?.spend, currency)} />
                      <Metric label="Clicks" value={count(c.insights?.clicks)} />
                      <Metric label="CTR" value={c.insights ? `${c.insights.ctr.toFixed(2)}%` : "—"} />
                    </div>
                    <button
                      onClick={() => toggle(c.id, c.effectiveStatus, c.name)}
                      disabled={busy === c.id}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium disabled:opacity-50",
                        c.effectiveStatus === "ACTIVE"
                          ? "border-border text-muted hover:text-foreground"
                          : "border-success/50 text-success"
                      )}
                    >
                      {c.effectiveStatus === "ACTIVE" ? (
                        <>
                          <Pause className="h-4 w-4" /> Pause
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" /> Go live
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setOpen(open === c.id ? null : c.id)}
                      className="text-sm font-medium text-accent"
                    >
                      {open === c.id ? "Hide ads" : `Ads (${ads.length})`}
                    </button>
                  </div>
                </div>

                {open === c.id && (
                  <div className="border-t border-border p-4">
                    {ads.length === 0 ? (
                      <p className="text-sm text-muted">No ads under this campaign.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {ads.map((a) => (
                          <div key={a.id} className="rounded-xl bg-surface-raised p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="flex items-center gap-2 text-sm font-medium">
                                {a.name}
                                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", statusTone(a.effectiveStatus))}>
                                  {a.effectiveStatus}
                                </span>
                              </p>
                              <div className="flex items-center gap-4 text-xs text-muted">
                                <span>{money(a.insights?.spend, currency)}</span>
                                <span>{count(a.insights?.clicks)} clicks</span>
                                {a.previewUrl && (
                                  <a
                                    href={a.previewUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-accent"
                                  >
                                    Preview <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                                <button
                                  onClick={() => toggle(a.id, a.effectiveStatus, a.name)}
                                  disabled={busy === a.id}
                                  className="font-medium text-accent disabled:opacity-50"
                                >
                                  {a.effectiveStatus === "ACTIVE" ? "Pause" : "Go live"}
                                </button>
                              </div>
                            </div>
                            {a.reviewFeedback && (
                              <p className="mt-2 rounded-lg bg-danger/10 p-2 text-xs text-danger">
                                Meta rejected this ad: {a.reviewFeedback}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-lg font-bold">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

/**
 * Shown whether or not the integration is connected. The policy is the thing
 * most likely to stop this working, and it stops it *after* you've built the
 * campaign — so it belongs above the tool, not in a footnote.
 */
function PolicyWarning() {
  return (
    <div className="flex gap-3 rounded-xl border border-warning/40 bg-warning/5 p-4 text-sm">
      <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
      <div>
        <p className="font-semibold">Meta restricts betting and gambling ads.</p>
        <p className="mt-1 text-muted">
          Running these without written permission from Meta gets creatives rejected and can get the
          whole ad account disabled — which also stops the Page advertising anything else. Apply
          first, and keep the 18+ targeting floor in place. Everything created here starts{" "}
          <strong>paused</strong>; nothing spends until you set it live.
        </p>
      </div>
    </div>
  );
}

function CreateForm({
  assets,
  maxDailyBudget,
  currency,
  copyDefaults,
  onDone,
}: {
  assets: string[];
  maxDailyBudget: number;
  currency: string;
  copyDefaults?: { headline: string; description: string } | null;
  onDone: (message: string) => void;
}) {
  const [name, setName] = useState("Supercapper");
  const [objective, setObjective] = useState<string>("OUTCOME_TRAFFIC");
  const [dailyBudget, setDailyBudget] = useState("20");
  const [countries, setCountries] = useState<string[]>(["GB", "IE"]);
  const [ageMin, setAgeMin] = useState("18");
  const [ageMax, setAgeMax] = useState("65");
  const [asset, setAsset] = useState(assets[0] ?? "");
  const [message, setMessage] = useState(
    "$10,000 guaranteed, free to enter. Post your picks, every one graded in public, best ROI wins."
  );
  const [headline, setHeadline] = useState(copyDefaults?.headline ?? "Supercapper contest");
  const [description, setDescription] = useState(copyDefaults?.description ?? "Free to enter.");
  const [linkUrl, setLinkUrl] = useState("https://blitz.tips/supercapper");
  const [callToAction, setCallToAction] = useState<string>("LEARN_MORE");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          objective,
          dailyBudget: Number(dailyBudget),
          countries,
          ageMin: Number(ageMin),
          ageMax: Number(ageMax),
          asset,
          message,
          headline,
          description,
          linkUrl,
          callToAction,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const partial = json.partial as { campaignId?: string; adSetId?: string } | undefined;
        const orphans =
          partial && (partial.campaignId || partial.adSetId)
            ? ` Objects already created in Meta (delete them there): ${[partial.campaignId, partial.adSetId]
                .filter(Boolean)
                .join(", ")}.`
            : "";
        setErr(`${json.error}${orphans}`);
        return;
      }
      onDone(`Created "${name}" — campaign, ad set and ad, all paused. Review in Meta, then set live here.`);
    } catch {
      setErr("Couldn't reach the server");
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm";

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border p-5">
      <p className="text-sm text-muted">
        Creates a campaign, ad set and ad in one go — Meta needs all three before anything can run.
        All three are created <strong>paused</strong>.
      </p>

      {err && <div className="rounded-lg border border-danger/40 bg-danger/5 p-3 text-sm text-danger">{err}</div>}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Campaign name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">Objective</span>
          <select value={objective} onChange={(e) => setObjective(e.target.value)} className={field}>
            {CAMPAIGN_OBJECTIVES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted">
            {CAMPAIGN_OBJECTIVES.find((o) => o.value === objective)?.hint}
          </span>
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">
            Daily budget ({currency}) — capped at {maxDailyBudget}
          </span>
          <input
            type="number"
            min={1}
            max={maxDailyBudget}
            value={dailyBudget}
            onChange={(e) => setDailyBudget(e.target.value)}
            className={field}
          />
        </label>

        <div className="text-sm">
          <span className="mb-1 block font-medium">Countries</span>
          <div className="flex flex-wrap gap-2">
            {COUNTRY_PRESETS.map((p) => {
              const on = p.codes.every((c) => countries.includes(c));
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() =>
                    setCountries(on ? countries.filter((c) => !p.codes.includes(c)) : [...new Set([...countries, ...p.codes])])
                  }
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium",
                    on ? "border-accent bg-accent/10 text-accent" : "border-border text-muted"
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-muted">{countries.join(", ") || "none selected"}</p>
        </div>

        <label className="text-sm">
          <span className="mb-1 block font-medium">Age range (18 minimum)</span>
          <div className="flex gap-2">
            <input type="number" min={18} max={65} value={ageMin} onChange={(e) => setAgeMin(e.target.value)} className={field} />
            <input type="number" min={18} max={65} value={ageMax} onChange={(e) => setAgeMax(e.target.value)} className={field} />
          </div>
        </label>

        <label className="text-sm">
          <span className="mb-1 block font-medium">Creative</span>
          <select value={asset} onChange={(e) => setAsset(e.target.value)} className={field}>
            {assets.map((a) => (
              <option key={a} value={a}>
                {a.replace("supercapper-", "").replace(".png", "")}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-muted">From public/marketing — rendered by the brand scripts.</span>
        </label>
      </div>

      <label className="text-sm">
        <span className="mb-1 block font-medium">Primary text</span>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className={field} />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium">Headline</span>
          <input value={headline} onChange={(e) => setHeadline(e.target.value)} className={field} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Description</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={field} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Destination URL</span>
          <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className={field} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Call to action</span>
          <select value={callToAction} onChange={(e) => setCallToAction(e.target.value)} className={field}>
            {CALL_TO_ACTIONS.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        onClick={submit}
        disabled={busy || !asset || countries.length === 0}
        className="self-start rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create (paused)"}
      </button>
    </div>
  );
}
