// Catalog of the reorderable sections on each dashboard, plus a resolver that
// turns a saved order (from the admin CMS) into a concrete render order. Pure
// and dependency-free so it's safe to import from both server pages and the
// admin CMS client component.

export interface DashboardSection {
  key: string;
  label: string;
  description: string;
}

export const HANDICAPPER_SECTIONS: DashboardSection[] = [
  { key: "postPick", label: "Post a pick & your picks", description: "The posting forms and the list of your picks" },
  { key: "stats", label: "Stats overview", description: "Record, win rate, subscribers, earnings, ROI, streak" },
  { key: "performance", label: "Performance charts", description: "Units-over-time chart and last-30-days panel" },
  { key: "breakdowns", label: "Breakdown tables", description: "By-sport and by-bet-type records" },
  { key: "plan", label: "Platform plan", description: "Your Blitz.tips plan and commission" },
  { key: "pricing", label: "Subscriber pricing", description: "Weekly / monthly / annual package prices" },
  { key: "community", label: "Socials & reviews", description: "Social links and your subscriber reviews" },
];

export const SUBSCRIBER_SECTIONS: DashboardSection[] = [
  { key: "summary", label: "Summary stats", description: "Subscriptions, spend, combined record and units" },
  { key: "handicappers", label: "Your handicappers", description: "Per-capper performance cards" },
  { key: "following", label: "Following", description: "Handicappers you follow, paid plans first then alphabetical" },
  { key: "feed", label: "Picks feed", description: "Upcoming and recent picks, plus your subscriptions" },
];

// The public handicapper profile page (blitz.tips/handicappers/[handle]). The
// cover, avatar, name, socials, bio, and subscribe box stay pinned; these
// stacked sections below them are reorderable.
export const PROFILE_SECTIONS: DashboardSection[] = [
  { key: "pendingPlays", label: "Pending tips", description: "The handicapper's pending picks" },
  { key: "stats", label: "Stats", description: "Record, win rate, net units, ROI, plus the L10 / last-30 line" },
  { key: "trackRecord", label: "Track record", description: "Settled picks history" },
  { key: "reviews", label: "Reviews", description: "Subscriber star ratings and written reviews" },
];

export const DASHBOARD_ORDER_SETTING = {
  handicapper: "dashboard_order_handicapper",
  subscriber: "dashboard_order_subscriber",
  profile: "profile_order_sections",
} as const;

export type DashboardKind = keyof typeof DASHBOARD_ORDER_SETTING;

export function sectionsFor(kind: DashboardKind): DashboardSection[] {
  switch (kind) {
    case "handicapper":
      return HANDICAPPER_SECTIONS;
    case "subscriber":
      return SUBSCRIBER_SECTIONS;
    case "profile":
      return PROFILE_SECTIONS;
  }
}

/**
 * Resolve a saved order into the final list of section keys: keep the saved
 * order (dropping anything unknown), then append any catalog sections the saved
 * order didn't mention (so newly added sections still render, at the end).
 */
export function resolveSectionOrder(kind: DashboardKind, savedJson: string | null): string[] {
  const validKeys = sectionsFor(kind).map((s) => s.key);
  let saved: unknown = [];
  try {
    saved = savedJson ? JSON.parse(savedJson) : [];
  } catch {
    saved = [];
  }
  const savedList = Array.isArray(saved) ? saved.filter((k): k is string => typeof k === "string") : [];
  const ordered = savedList.filter((k) => validKeys.includes(k));
  for (const k of validKeys) if (!ordered.includes(k)) ordered.push(k);
  return ordered;
}
