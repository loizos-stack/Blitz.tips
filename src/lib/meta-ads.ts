import "server-only";

/**
 * Meta (Facebook/Instagram) Marketing API client.
 *
 * Optional integration: without a token the Ads tab renders a setup card and
 * nothing else in the app changes.
 *
 * ## Two things to know before using this
 *
 * **Meta restricts gambling and betting ads.** A handicapping/tipster site is
 * squarely inside that policy. Running ads without written permission from Meta
 * gets creatives rejected and can get the whole ad account disabled — which
 * also kills the Page's other advertising. Get the permission first; this tool
 * does not and cannot grant it.
 *
 * **Everything this creates is PAUSED.** An admin panel that can start spending
 * real money on a button press is a bad trade: the mistake is expensive,
 * immediate, and not undoable. Campaigns, ad sets and ads are all created with
 * status PAUSED, and `setStatus` is the only way to change that — a separate,
 * deliberate action with its own confirmation. See PAUSED_ON_CREATE.
 *
 * ## Structure
 *
 * Meta's hierarchy is four levels and you need all of them for one live ad:
 *
 *   Campaign  — objective and the buying type
 *     AdSet   — budget, schedule, targeting, optimisation goal
 *       Ad    — pairs an ad set with a creative
 *         AdCreative — the actual image/video, copy and link
 *
 * Insights (spend, impressions, clicks) are queried per level and are the
 * source of truth. Nothing is mirrored into our database: Meta already stores
 * it, a local copy drifts, and a drifting copy of a spend figure is worse than
 * no copy. The cost is that reporting needs a live call, hence CACHE_SECONDS.
 */

import {
  OPTIMIZATION_FOR_OBJECTIVE,
  PAUSED_ON_CREATE,
  type AccountMeta,
  type Ad,
  type AdInsights,
  type AdSet,
  type Campaign,
  type CampaignObjective,
  type DatePreset,
} from "@/lib/meta-ads-shared";

// Re-exported so server callers can import everything from one place; the UI
// imports the same names from meta-ads-shared, which carries no credentials.
export * from "@/lib/meta-ads-shared";

const API_VERSION = process.env.META_API_VERSION?.trim() || "v21.0";
// Overridable so the flow can be exercised against a stub without touching a
// real ad account — same escape hatch NOWPAYMENTS_API_BASE provides. Never set
// this in production; it is where the access token gets sent.
const API_BASE = (process.env.META_API_BASE?.trim() || "https://graph.facebook.com").replace(/\/+$/, "");
const API = `${API_BASE}/${API_VERSION}`;

const ACCESS_TOKEN = process.env.META_ADS_ACCESS_TOKEN?.trim() ?? "";
const PAGE_ID = process.env.META_PAGE_ID?.trim() ?? "";

/**
 * Ad account id. Meta wants it prefixed `act_`; accept it either way, because
 * the dashboard shows it bare and pasting the bare value is the obvious
 * mistake to make.
 */
const AD_ACCOUNT_ID = (() => {
  const raw = process.env.META_AD_ACCOUNT_ID?.trim() ?? "";
  if (!raw) return "";
  return raw.startsWith("act_") ? raw : `act_${raw}`;
})();

/** Reporting reads are cached briefly — spend figures move by the minute, not the second. */
const CACHE_SECONDS = 300;

/**
 * Hard ceiling on a daily budget, in whole currency units, for anything created
 * through this panel. Not a Meta limit — ours. A fat-fingered extra zero on a
 * daily budget is the single most expensive mistake available here, and the
 * ceiling costs nothing when the intended number is under it. Override per
 * deployment if the real spend outgrows it.
 */
export const MAX_DAILY_BUDGET = Number(process.env.META_MAX_DAILY_BUDGET?.trim()) || 500;

export function metaAdsConfigured(): boolean {
  return Boolean(ACCESS_TOKEN && AD_ACCOUNT_ID);
}

/** Creating ads additionally needs a Page to run them from. */
export function metaAdsCanCreate(): boolean {
  return metaAdsConfigured() && Boolean(PAGE_ID);
}

export function metaAdAccountId(): string {
  return AD_ACCOUNT_ID;
}

export class MetaAdsError extends Error {
  readonly status: number;
  /** Meta's own error subcode, useful for telling a permissions problem from a validation one. */
  readonly code: number | null;

  constructor(message: string, status: number, code: number | null) {
    super(message);
    this.name = "MetaAdsError";
    this.status = status;
    this.code = code;
  }
}

interface GraphErrorBody {
  error?: {
    message?: string;
    code?: number;
    error_user_msg?: string;
    error_user_title?: string;
  };
}

/**
 * Turn a Graph error into something an admin can act on. Meta returns a
 * developer-facing `message` and, for the errors a human caused, a much better
 * `error_user_msg` — prefer the latter when it exists.
 */
async function graphError(res: Response): Promise<MetaAdsError> {
  const body = (await res.json().catch(() => null)) as GraphErrorBody | null;
  const err = body?.error;
  const detail = err?.error_user_msg || err?.message || `Meta returned ${res.status}`;
  const title = err?.error_user_title ? `${err.error_user_title}: ` : "";
  return new MetaAdsError(`${title}${detail}`, res.status, err?.code ?? null);
}

async function graphGet<T>(path: string, params: Record<string, string>, revalidate = CACHE_SECONDS): Promise<T> {
  const qs = new URLSearchParams({ ...params, access_token: ACCESS_TOKEN });
  const res = await fetch(`${API}/${path}?${qs}`, { next: { revalidate } });
  if (!res.ok) throw await graphError(res);
  return (await res.json()) as T;
}

async function graphPost<T>(path: string, body: Record<string, string>): Promise<T> {
  const form = new URLSearchParams({ ...body, access_token: ACCESS_TOKEN });
  const res = await fetch(`${API}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
    cache: "no-store",
  });
  if (!res.ok) throw await graphError(res);
  return (await res.json()) as T;
}

/** Meta reports money in minor units (cents) as strings. */
function minorToMajor(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n / 100 : null;
}

function num(value: string | number | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

interface RawInsights {
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
}

function parseInsights(raw: { data?: RawInsights[] } | undefined): AdInsights | null {
  const row = raw?.data?.[0];
  if (!row) return null;
  return {
    spend: num(row.spend),
    impressions: num(row.impressions),
    clicks: num(row.clicks),
    reach: num(row.reach),
    ctr: num(row.ctr),
    cpc: num(row.cpc),
    cpm: num(row.cpm),
  };
}

// Requested as a nested field on the parent read, so one call returns objects
// and their numbers instead of one call per object.
const INSIGHTS_FIELD = (preset: DatePreset) =>
  `insights.date_preset(${preset}){spend,impressions,clicks,reach,ctr,cpc,cpm}`;

interface RawCampaign {
  id: string;
  name: string;
  objective: string;
  status: string;
  effective_status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  created_time: string;
  insights?: { data?: RawInsights[] };
}

export async function listCampaigns(preset: DatePreset = "last_30d"): Promise<Campaign[]> {
  const json = await graphGet<{ data: RawCampaign[] }>(`${AD_ACCOUNT_ID}/campaigns`, {
    fields: [
      "id",
      "name",
      "objective",
      "status",
      "effective_status",
      "daily_budget",
      "lifetime_budget",
      "created_time",
      INSIGHTS_FIELD(preset),
    ].join(","),
    limit: "50",
  });

  return (json.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    objective: c.objective,
    status: c.status,
    effectiveStatus: c.effective_status,
    dailyBudget: minorToMajor(c.daily_budget),
    lifetimeBudget: minorToMajor(c.lifetime_budget),
    createdTime: c.created_time,
    insights: parseInsights(c.insights),
  }));
}

interface RawAdSet {
  id: string;
  campaign_id: string;
  name: string;
  status: string;
  effective_status: string;
  daily_budget?: string;
  optimization_goal?: string;
  insights?: { data?: RawInsights[] };
}

export async function listAdSets(campaignId: string, preset: DatePreset = "last_30d"): Promise<AdSet[]> {
  const json = await graphGet<{ data: RawAdSet[] }>(`${campaignId}/adsets`, {
    fields: [
      "id",
      "campaign_id",
      "name",
      "status",
      "effective_status",
      "daily_budget",
      "optimization_goal",
      INSIGHTS_FIELD(preset),
    ].join(","),
    limit: "50",
  });

  return (json.data ?? []).map((s) => ({
    id: s.id,
    campaignId: s.campaign_id,
    name: s.name,
    status: s.status,
    effectiveStatus: s.effective_status,
    dailyBudget: minorToMajor(s.daily_budget),
    optimizationGoal: s.optimization_goal ?? null,
    insights: parseInsights(s.insights),
  }));
}

interface RawAd {
  id: string;
  adset_id: string;
  name: string;
  status: string;
  effective_status: string;
  // Meta spells this two ways across versions; accept either.
  ad_review_feedback?: { global?: Record<string, string> };
  preview_shareable_link?: string;
  insights?: { data?: RawInsights[] };
}

export async function listAds(campaignId: string, preset: DatePreset = "last_30d"): Promise<Ad[]> {
  const json = await graphGet<{ data: RawAd[] }>(`${campaignId}/ads`, {
    fields: [
      "id",
      "adset_id",
      "name",
      "status",
      "effective_status",
      "ad_review_feedback",
      "preview_shareable_link",
      INSIGHTS_FIELD(preset),
    ].join(","),
    limit: "100",
  });

  return (json.data ?? []).map((a) => {
    // Rejection reasons arrive as an object keyed by policy name. Flatten to
    // one readable line — an admin needs "why", not the taxonomy.
    const feedback = a.ad_review_feedback?.global;
    const reasons = feedback ? Object.values(feedback).filter(Boolean) : [];
    return {
      id: a.id,
      adSetId: a.adset_id,
      name: a.name,
      status: a.status,
      effectiveStatus: a.effective_status,
      reviewStatus: a.effective_status === "DISAPPROVED" ? "DISAPPROVED" : null,
      reviewFeedback: reasons.length > 0 ? reasons.join(" · ") : null,
      previewUrl: a.preview_shareable_link ?? null,
      insights: parseInsights(a.insights),
    };
  });
}

/** Account-level totals for the header, in one call. */
export async function accountInsights(preset: DatePreset = "last_30d"): Promise<AdInsights | null> {
  const json = await graphGet<{ data?: RawInsights[] }>(`${AD_ACCOUNT_ID}/insights`, {
    fields: "spend,impressions,clicks,reach,ctr,cpc,cpm",
    date_preset: preset,
  });
  return parseInsights(json);
}

export async function accountMeta(): Promise<AccountMeta> {
  const json = await graphGet<{
    name: string;
    currency: string;
    account_status: number;
    amount_spent?: string;
    balance?: string;
  }>(AD_ACCOUNT_ID, { fields: "name,currency,account_status,amount_spent,balance" });

  return {
    name: json.name,
    currency: json.currency,
    accountStatus: json.account_status,
    amountSpent: minorToMajor(json.amount_spent),
    balance: minorToMajor(json.balance),
  };
}

// ---------------------------------------------------------------- writes ----

export interface CreateCampaignInput {
  name: string;
  objective: CampaignObjective;
}

/**
 * Create a paused campaign.
 *
 * `special_ad_categories` is required by Meta and must be sent even when empty
 * — omitting it is a validation error, not a default. We send `[]`: the
 * regulated categories are credit, employment, housing, social issues and
 * politics. Gambling is *not* one of them; it's governed by the separate
 * written-permission process, which no API field expresses.
 */
export async function createCampaign(input: CreateCampaignInput): Promise<{ id: string }> {
  return graphPost<{ id: string }>(`${AD_ACCOUNT_ID}/campaigns`, {
    name: input.name,
    objective: input.objective,
    status: PAUSED_ON_CREATE,
    special_ad_categories: "[]",
  });
}

export interface CreateAdSetInput {
  campaignId: string;
  name: string;
  objective: CampaignObjective;
  /** Whole currency units per day. Converted to minor units for Meta. */
  dailyBudget: number;
  /** ISO country codes, e.g. ["GB", "IE"]. */
  countries: string[];
  ageMin: number;
  ageMax: number;
  /** Optional ISO end time. Meta requires one when the campaign has no lifetime budget only in some cases; harmless to send. */
  endTime?: string | null;
}

export async function createAdSet(input: CreateAdSetInput): Promise<{ id: string }> {
  const body: Record<string, string> = {
    name: input.name,
    campaign_id: input.campaignId,
    daily_budget: String(Math.round(input.dailyBudget * 100)),
    billing_event: "IMPRESSIONS",
    optimization_goal: OPTIMIZATION_FOR_OBJECTIVE[input.objective],
    status: PAUSED_ON_CREATE,
    targeting: JSON.stringify({
      geo_locations: { countries: input.countries },
      age_min: input.ageMin,
      age_max: input.ageMax,
    }),
  };
  if (input.endTime) body.end_time = input.endTime;
  return graphPost<{ id: string }>(`${AD_ACCOUNT_ID}/adsets`, body);
}

/**
 * Upload an image to the ad account's library and return its hash, which is
 * what a creative references. Meta takes the raw bytes as a multipart upload.
 */
export async function uploadAdImage(bytes: Buffer, filename: string): Promise<{ hash: string }> {
  const form = new FormData();
  form.append("access_token", ACCESS_TOKEN);
  form.append(
    "filename",
    new Blob([new Uint8Array(bytes)], { type: "image/png" }),
    filename
  );

  const res = await fetch(`${API}/${AD_ACCOUNT_ID}/adimages`, { method: "POST", body: form, cache: "no-store" });
  if (!res.ok) throw await graphError(res);

  // Response shape is { images: { <filename>: { hash, url } } } — keyed by the
  // name Meta assigned, which is not always the one we sent, so take the first.
  const json = (await res.json()) as { images?: Record<string, { hash: string }> };
  const first = Object.values(json.images ?? {})[0];
  if (!first?.hash) throw new MetaAdsError("Meta accepted the image but returned no hash", 502, null);
  return { hash: first.hash };
}

export interface CreateAdInput {
  adSetId: string;
  name: string;
  /** Image hash from uploadAdImage. */
  imageHash: string;
  message: string;
  headline: string;
  description: string;
  linkUrl: string;
  callToAction: string;
}

/** Create the creative and the ad that references it. Both paused. */
export async function createAd(input: CreateAdInput): Promise<{ id: string; creativeId: string }> {
  const creative = await graphPost<{ id: string }>(`${AD_ACCOUNT_ID}/adcreatives`, {
    name: `${input.name} — creative`,
    object_story_spec: JSON.stringify({
      page_id: PAGE_ID,
      link_data: {
        image_hash: input.imageHash,
        link: input.linkUrl,
        message: input.message,
        name: input.headline,
        description: input.description,
        call_to_action: { type: input.callToAction, value: { link: input.linkUrl } },
      },
    }),
  });

  const ad = await graphPost<{ id: string }>(`${AD_ACCOUNT_ID}/ads`, {
    name: input.name,
    adset_id: input.adSetId,
    creative: JSON.stringify({ creative_id: creative.id }),
    status: PAUSED_ON_CREATE,
  });

  return { id: ad.id, creativeId: creative.id };
}

export type ObjectLevel = "campaign" | "adset" | "ad";

/**
 * Pause or resume an existing object. The only path to ACTIVE — deliberately
 * separate from creation, and the callers of this log to the audit trail.
 */
export async function setStatus(id: string, status: "ACTIVE" | "PAUSED"): Promise<void> {
  await graphPost(id, { status });
}
