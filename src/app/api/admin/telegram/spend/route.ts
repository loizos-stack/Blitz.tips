import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * The manual ad-spend ledger.
 *
 * Exists because Telegram's ad platform has no public API — nothing returns
 * what a campaign spent, so the only way to have the number is to type it in.
 * `platform` is free text so Reddit, TikTok or a podcast sponsorship can be
 * logged the same way.
 *
 * Meta is deliberately excluded: its figures come live from the Marketing API,
 * and a hand-entered second copy of a number the API already owns would only
 * ever drift out of step with it.
 */

const BLOCKED_PLATFORMS = new Set(["meta", "facebook", "instagram"]);

export async function POST(request: Request) {
  const ctx = await requirePermission("telegram");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const body = await request.json().catch(() => ({}));

  const platform = typeof body.platform === "string" ? body.platform.trim() : "";
  if (!platform) return NextResponse.json({ error: "Platform is required" }, { status: 400 });
  if (BLOCKED_PLATFORMS.has(platform.toLowerCase())) {
    return NextResponse.json(
      { error: "Meta spend is read live from the Marketing API on the Ads tab — don't duplicate it here." },
      { status: 400 }
    );
  }

  const campaign = typeof body.campaign === "string" ? body.campaign.trim() : "";
  if (!campaign) return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });

  const spentOn = new Date(String(body.spentOn ?? ""));
  if (Number.isNaN(spentOn.getTime())) {
    return NextResponse.json({ error: "Pick a valid date" }, { status: 400 });
  }
  // A spend date in the future is a typo — most often a year mistyped.
  if (spentOn.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: "Spend date can't be in the future" }, { status: 400 });
  }

  const spend = Number(body.spend);
  if (!Number.isFinite(spend) || spend < 0) {
    return NextResponse.json({ error: "Spend must be zero or more" }, { status: 400 });
  }

  const currency = typeof body.currency === "string" && /^[A-Z]{3}$/.test(body.currency.trim().toUpperCase())
    ? body.currency.trim().toUpperCase()
    : "USD";

  const optionalCount = (value: unknown): number | null => {
    if (value == null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  };

  const entry = await prisma.adSpendEntry.create({
    data: {
      platform,
      campaign,
      spentOn,
      spendCents: Math.round(spend * 100),
      currency,
      impressions: optionalCount(body.impressions),
      clicks: optionalCount(body.clicks),
      notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
      createdById: ctx.userId,
    },
  });

  await logAdmin(
    ctx.session,
    "adspend.create",
    "AdSpendEntry",
    entry.id,
    `${platform} · ${campaign} · ${spend} ${currency}`
  );

  return NextResponse.json({ ok: true, id: entry.id });
}
