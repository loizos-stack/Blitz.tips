import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { estimateRunCost, getPropSettings, PROP_SPORTS, POLL_MINUTES } from "@/lib/player-props-poll";

export const dynamic = "force-dynamic";

const int = (v: unknown, fallback: number, min: number, max: number) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const num = (v: unknown, fallback: number, min: number, max: number) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

/**
 * Save the watcher's settings.
 *
 * Every numeric field is clamped rather than merely validated, because each one
 * multiplies into the daily bill: a typo in "events per cycle" is not a broken
 * form, it is a four-figure credit charge. The bounds are what the tool can
 * survive, not what the form can parse.
 */
export async function POST(request: Request) {
  const ctx = await requirePermission("props");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const current = await getPropSettings();

  // Only sports that actually carry player props. A name that is not one of
  // them is dropped rather than stored, so the watcher never spends a cycle
  // resolving something it can never read.
  const sports = String(body.sports ?? current.sports)
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => (PROP_SPORTS as string[]).includes(s));

  const data = {
    enabled: Boolean(body.enabled),
    sports: sports.join(","),
    // Four hours ahead at most: props posted a day early barely move, and every
    // extra hour widens the pool of events the budget has to cover.
    windowMinutes: int(body.windowMinutes, current.windowMinutes, 15, 1440),
    clusterMinutes: int(body.clusterMinutes, current.clusterMinutes, 2, 120),
    // Two props is the point of the tool; one is the noise it exists to reject.
    minProps: int(body.minProps, current.minProps, 2, 10),
    minBooks: int(body.minBooks, current.minBooks, 2, 10),
    minProbDelta: num(body.minProbDelta, current.minProbDelta, 0.5, 50),
    countLineMoves: Boolean(body.countLineMoves),
    dailyCreditCap: int(body.dailyCreditCap, current.dailyCreditCap, 0, 100_000),
    maxEventsPerRun: int(body.maxEventsPerRun, current.maxEventsPerRun, 1, 40),
  };

  await prisma.propWatchSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...data },
    update: data,
  });

  await logAdmin(
    ctx.session,
    "props.settings",
    "PropWatchSettings",
    "default",
    `${data.enabled ? "On" : "Off"} · ${data.sports || "all sports"} · cap ${data.dailyCreditCap}/day`
  );

  const settings = await getPropSettings();
  return NextResponse.json({ ok: true, estimate: estimateRunCost(settings, POLL_MINUTES) });
}
