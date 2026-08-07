/**
 * Types and option lists shared by the Meta Ads server client and the admin UI.
 *
 * Plain module (no "server-only") on purpose: the admin form renders the same
 * objective and call-to-action lists the API route validates against, and the
 * two have to agree. Keeping them here means a new objective can't be offered
 * in the dropdown without also being accepted by the server.
 *
 * Nothing here touches credentials or the network — that all lives in
 * lib/meta-ads, which stays server-only.
 */

export type EffectiveStatus = "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED" | string;

export interface AdInsights {
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  /** Click-through rate as a percentage, as Meta reports it. */
  ctr: number;
  /** Cost per click, in the account currency. */
  cpc: number;
  /** Cost per 1,000 impressions. */
  cpm: number;
}

export interface Campaign {
  id: string;
  name: string;
  objective: string;
  status: string;
  effectiveStatus: EffectiveStatus;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  createdTime: string;
  insights: AdInsights | null;
}

export interface AdSet {
  id: string;
  campaignId: string;
  name: string;
  status: string;
  effectiveStatus: EffectiveStatus;
  dailyBudget: number | null;
  optimizationGoal: string | null;
  insights: AdInsights | null;
}

export interface Ad {
  id: string;
  adSetId: string;
  name: string;
  status: string;
  effectiveStatus: EffectiveStatus;
  /** Meta's own review verdict — the field that says "rejected". */
  reviewStatus: string | null;
  reviewFeedback: string | null;
  previewUrl: string | null;
  insights: AdInsights | null;
}

export interface AccountMeta {
  name: string;
  currency: string;
  /** Meta's own account status: 1 = active, 2 = disabled, 3 = unsettled, … */
  accountStatus: number;
  amountSpent: number | null;
  balance: number | null;
}

// Objectives worth exposing. Meta has more, but the rest either need a shop
// catalogue, an installed app, or a lead form we don't have — offering them
// would just produce campaigns that fail validation at the ad-set step.
export const CAMPAIGN_OBJECTIVES = [
  { value: "OUTCOME_TRAFFIC", label: "Traffic", hint: "Send people to blitz.tips. The default for the contest." },
  { value: "OUTCOME_AWARENESS", label: "Awareness", hint: "Cheapest reach; optimises for impressions, not clicks." },
  { value: "OUTCOME_ENGAGEMENT", label: "Engagement", hint: "Post reactions, comments and shares." },
  { value: "OUTCOME_LEADS", label: "Leads", hint: "Needs a pixel with a conversion event configured." },
] as const;

export type CampaignObjective = (typeof CAMPAIGN_OBJECTIVES)[number]["value"];

export const OBJECTIVE_VALUES: readonly string[] = CAMPAIGN_OBJECTIVES.map((o) => o.value);

/**
 * Optimisation goal per objective. Meta rejects mismatched pairs with an error
 * that names neither the objective nor the goal, so pick it for the caller
 * rather than letting them guess.
 */
export const OPTIMIZATION_FOR_OBJECTIVE: Record<CampaignObjective, string> = {
  OUTCOME_TRAFFIC: "LINK_CLICKS",
  OUTCOME_AWARENESS: "REACH",
  OUTCOME_ENGAGEMENT: "POST_ENGAGEMENT",
  OUTCOME_LEADS: "LEAD_GENERATION",
};

export const CALL_TO_ACTIONS = ["LEARN_MORE", "SIGN_UP", "GET_OFFER", "PLAY_GAME", "SEE_MORE"] as const;

export type DatePreset = "today" | "yesterday" | "last_7d" | "last_30d" | "maximum";

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7d", label: "Last 7 days" },
  { value: "last_30d", label: "Last 30 days" },
  { value: "maximum", label: "Lifetime" },
];

/** Every object the admin panel creates starts paused. */
export const PAUSED_ON_CREATE = "PAUSED" as const;

/** Minimum Meta will accept for a daily budget in most currencies. */
export const MIN_DAILY_BUDGET = 1;
