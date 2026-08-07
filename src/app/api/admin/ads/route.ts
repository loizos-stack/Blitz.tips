import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join, basename } from "path";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";
import {
  MetaAdsError,
  MAX_DAILY_BUDGET,
  MIN_DAILY_BUDGET,
  OBJECTIVE_VALUES,
  OPTIMIZATION_FOR_OBJECTIVE,
  CALL_TO_ACTIONS,
  createAd,
  createAdSet,
  createCampaign,
  metaAdsCanCreate,
  uploadAdImage,
  type CampaignObjective,
} from "@/lib/meta-ads";

export const dynamic = "force-dynamic";

/**
 * Build a whole paused campaign in one request: campaign → ad set → creative →
 * ad. Meta needs all four before anything can run, and creating them one
 * endpoint at a time leaves orphans behind whenever a later step fails.
 *
 * Nothing here can spend money. Every object is created PAUSED; going live is
 * the separate PATCH in ./[id]/status, which asks for confirmation and logs.
 *
 * Failure part-way through is reported with the ids that *were* created, so an
 * admin can find and delete them in Meta rather than hunting for orphans. We
 * deliberately don't auto-roll-back: a delete call that itself fails would turn
 * one clear error into two confusing ones.
 */
export async function POST(request: Request) {
  const ctx = await requirePermission("ads");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  if (!metaAdsCanCreate()) {
    return NextResponse.json(
      { error: "Ad creation needs META_ADS_ACCESS_TOKEN, META_AD_ACCOUNT_ID and META_PAGE_ID." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });

  const objective = String(body.objective ?? "");
  if (!OBJECTIVE_VALUES.includes(objective)) {
    return NextResponse.json({ error: "Pick a valid campaign objective" }, { status: 400 });
  }

  const dailyBudget = Number(body.dailyBudget);
  if (!Number.isFinite(dailyBudget) || dailyBudget < MIN_DAILY_BUDGET) {
    return NextResponse.json(
      { error: `Daily budget must be at least ${MIN_DAILY_BUDGET}` },
      { status: 400 }
    );
  }
  // The ceiling is ours, not Meta's — see MAX_DAILY_BUDGET. Rejecting loudly
  // beats creating a campaign nobody meant to fund.
  if (dailyBudget > MAX_DAILY_BUDGET) {
    return NextResponse.json(
      {
        error: `Daily budget of ${dailyBudget} exceeds the configured cap of ${MAX_DAILY_BUDGET}. Raise META_MAX_DAILY_BUDGET if that is intentional.`,
      },
      { status: 400 }
    );
  }

  const countries = Array.isArray(body.countries)
    ? body.countries
        .map((c: unknown) => String(c).trim().toUpperCase())
        .filter((c: string) => /^[A-Z]{2}$/.test(c))
    : [];
  if (countries.length === 0) {
    return NextResponse.json({ error: "Pick at least one target country" }, { status: 400 });
  }

  // 18 is a floor, not a default: the audience is betting content and every
  // jurisdiction that allows it sets a minimum age. Meta's own minimum is 13,
  // so the clamp has to be ours.
  const ageMin = Math.max(18, Math.min(65, Math.round(Number(body.ageMin) || 18)));
  const ageMax = Math.max(ageMin, Math.min(65, Math.round(Number(body.ageMax) || 65)));

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const headline = typeof body.headline === "string" ? body.headline.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const linkUrl = typeof body.linkUrl === "string" ? body.linkUrl.trim() : "";
  if (!message || !headline || !linkUrl) {
    return NextResponse.json(
      { error: "Primary text, headline and destination URL are all required" },
      { status: 400 }
    );
  }
  let link: URL;
  try {
    link = new URL(linkUrl);
    if (link.protocol !== "https:") throw new Error("not https");
  } catch {
    return NextResponse.json({ error: "Destination must be an https:// URL" }, { status: 400 });
  }

  const callToAction = String(body.callToAction ?? "LEARN_MORE");
  if (!(CALL_TO_ACTIONS as readonly string[]).includes(callToAction)) {
    return NextResponse.json({ error: "Unknown call to action" }, { status: 400 });
  }

  // The creative image is chosen from the rendered marketing set rather than
  // uploaded, so an ad can't ship artwork that never passed through the brand
  // scripts. basename() keeps a crafted value from walking out of the folder.
  const asset = basename(String(body.asset ?? ""));
  if (!asset.endsWith(".png")) {
    return NextResponse.json({ error: "Pick a .png from the marketing set" }, { status: 400 });
  }

  let imageBytes: Buffer;
  try {
    imageBytes = await readFile(join(process.cwd(), "public/marketing", asset));
  } catch {
    return NextResponse.json({ error: `No such marketing asset: ${asset}` }, { status: 400 });
  }

  const created: { campaignId?: string; adSetId?: string; adId?: string } = {};
  try {
    const campaign = await createCampaign({ name, objective: objective as CampaignObjective });
    created.campaignId = campaign.id;

    const adSet = await createAdSet({
      campaignId: campaign.id,
      name: `${name} — ${countries.join("/")}`,
      objective: objective as CampaignObjective,
      dailyBudget,
      countries,
      ageMin,
      ageMax,
    });
    created.adSetId = adSet.id;

    const { hash } = await uploadAdImage(imageBytes, asset);

    const ad = await createAd({
      adSetId: adSet.id,
      name: `${name} — ${asset.replace(/\.png$/, "")}`,
      imageHash: hash,
      message,
      headline,
      description,
      linkUrl: link.toString(),
      callToAction,
    });
    created.adId = ad.id;

    await logAdmin(
      ctx.session,
      "ads.create",
      "MetaCampaign",
      campaign.id,
      `${name} · ${objective} · ${dailyBudget}/day · ${countries.join(",")} · ${asset} (paused)`
    );

    return NextResponse.json({
      ok: true,
      ...created,
      optimizationGoal: OPTIMIZATION_FOR_OBJECTIVE[objective as CampaignObjective],
    });
  } catch (e) {
    const err = e instanceof MetaAdsError ? e : null;
    await logAdmin(
      ctx.session,
      "ads.create.failed",
      "MetaCampaign",
      created.campaignId ?? "-",
      `${name}: ${err?.message ?? String(e)}`
    );
    return NextResponse.json(
      {
        error: err?.message ?? "Meta rejected the request",
        metaCode: err?.code ?? null,
        // Whatever did get made, so it can be cleaned up by hand.
        partial: created,
      },
      { status: err?.status && err.status < 500 ? 400 : 502 }
    );
  }
}
