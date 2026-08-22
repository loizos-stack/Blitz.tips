import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";
import { estimateRunCost, getWatchSettings } from "@/lib/blitz-odds-poll";

export const dynamic = "force-dynamic";

/**
 * Update the watcher's settings.
 *
 * Every numeric field is clamped rather than trusted. These values decide how
 * much the tool spends, and a mistyped cap or a zero poll interval is the
 * difference between a useful tool and a drained quota — so the bounds live
 * here, on the server, not only in the form.
 */
const CLAMPS: Record<string, { min: number; max: number }> = {
  pollMinutes: { min: 2, max: 240 },
  leadHours: { min: 1, max: 48 },
  cutoffMinutes: { min: 0, max: 180 },
  minProbDelta: { min: 0.25, max: 50 },
  minBooks: { min: 1, max: 10 },
  dailyCreditCap: { min: 0, max: 500_000 },
  maxDeepEvents: { min: 0, max: 200 },
};

const BOOLEANS = [
  "enabled",
  "watchGameLines",
  "watchAlternates",
  "watchProps",
  "watchSoccerExtras",
  "notifyOnSite",
  "notifyPush",
  "notifyTelegram",
] as const;

export async function POST(request: Request) {
  const ctx = await requirePermission("odds");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  for (const key of Object.keys(CLAMPS)) {
    if (body[key] === undefined) continue;
    const n = Number(body[key]);
    if (!Number.isFinite(n)) {
      return NextResponse.json({ error: `${key} must be a number` }, { status: 400 });
    }
    const { min, max } = CLAMPS[key];
    data[key] = Math.min(max, Math.max(min, n));
  }

  for (const key of BOOLEANS) {
    if (body[key] !== undefined) data[key] = Boolean(body[key]);
  }

  if (typeof body.sportKeys === "string") {
    data.sportKeys = body.sportKeys
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean)
      .join(",");
  }
  if (typeof body.telegramChatId === "string") {
    data.telegramChatId = body.telegramChatId.trim();
  }

  const saved = await prisma.oddsWatchSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...data },
    update: data,
  });

  await logAdmin(
    ctx.session,
    "odds.settings",
    "OddsWatchSettings",
    "default",
    `Blitz Odds ${saved.enabled ? "on" : "off"}, cap ${saved.dailyCreditCap}/day, every ${saved.pollMinutes} min`
  );

  const estimate = await estimateRunCost(await getWatchSettings());
  return NextResponse.json({ ok: true, estimate });
}
