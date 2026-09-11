import { readdir } from "fs/promises";
import { join } from "path";
import { guardAdminPage } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/date-format";
import { AdsManager } from "@/components/admin/ads-manager";
import {
  DATE_PRESETS,
  MAX_DAILY_BUDGET,
  accountInsights,
  accountMeta,
  listAds,
  listCampaigns,
  metaAdsCanCreate,
  metaAdsConfigured,
  type Ad,
  type Campaign,
  type DatePreset,
} from "@/lib/meta-ads";

export const dynamic = "force-dynamic";

const PRESET_VALUES = new Set(DATE_PRESETS.map((p) => p.value as string));

export default async function AdminAdsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await guardAdminPage("ads");

  const { range } = await searchParams;
  const preset: DatePreset = PRESET_VALUES.has(range ?? "") ? (range as DatePreset) : "last_30d";

  if (!metaAdsConfigured()) {
    return <AdsManager configured={false} canCreate={false} preset={preset} assets={[]} />;
  }

  // Ad copy defaults come from the live contest row rather than being typed
  // into the component. A hardcoded "starts Aug 10" in a form default is how a
  // stale date ends up in a paid ad — the one place it costs money to be wrong.
  const contest = await prisma.contest
    .findUnique({
      where: { slug: "supercapper" },
      select: { startsAt: true, prizePoolCents: true },
    })
    .catch(() => null);

  const copyDefaults = contest
    ? {
        headline: `Supercapper — ${(contest.prizePoolCents / 100).toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        })} contest`,
        description: `Free to enter. Starts ${formatDate(contest.startsAt)}.`,
      }
    : null;

  // The marketing PNGs are the only creatives on offer — an ad can't ship
  // artwork that never went through the brand scripts. Videos are excluded:
  // Meta's video creatives need an upload-then-poll flow this doesn't do yet.
  const assets = await readdir(join(process.cwd(), "public/marketing"))
    .then((files) => files.filter((f) => f.endsWith(".png")).sort())
    .catch(() => [] as string[]);

  // One failure shouldn't blank the page — a token that can read insights but
  // not the account, or vice versa, is a common half-configured state and the
  // admin needs to see which half worked.
  const [account, totals, campaigns] = await Promise.all([
    accountMeta().catch(() => null),
    accountInsights(preset).catch(() => null),
    listCampaigns(preset).catch((e: Error) => e),
  ]);

  const campaignList: Campaign[] = campaigns instanceof Error ? [] : campaigns;
  const loadError = campaigns instanceof Error ? campaigns.message : null;

  // Ads are fetched per campaign so the table can show review verdicts —
  // "why is nothing running" is nearly always a disapproval, and that only
  // shows at the ad level.
  const adsByCampaign: Record<string, Ad[]> = {};
  await Promise.all(
    campaignList.map(async (c) => {
      adsByCampaign[c.id] = await listAds(c.id, preset).catch(() => []);
    })
  );

  return (
    <AdsManager
      configured
      canCreate={metaAdsCanCreate()}
      preset={preset}
      account={account}
      totals={totals}
      campaigns={campaignList}
      adsByCampaign={adsByCampaign}
      assets={assets}
      maxDailyBudget={MAX_DAILY_BUDGET}
      copyDefaults={copyDefaults}
      loadError={loadError}
    />
  );
}
