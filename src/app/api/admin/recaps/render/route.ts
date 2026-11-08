import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";
import { normalizeHandles, recapFor, winnersFor } from "@/lib/recap";
import { dispatchRecapRender, recapDispatchConfig } from "@/lib/recap-dispatch";

/**
 * Make a recap video, now, for the day and the handicappers asked for.
 *
 * Recaps used to render themselves every morning whether anyone wanted one or
 * not. They don't any more — this is the only thing that starts one, besides
 * the Run workflow button on GitHub.
 *
 * The render happens on a GitHub runner (Vercel has no browser and no
 * ffmpeg), so this validates the request, checks there is actually something
 * to render, and hands it over.
 */

const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  const ctx = await requirePermission("recaps");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const mode = body?.mode === "winners" ? "winners" : "recap";
  const date = typeof body?.date === "string" ? body.date.trim() : "";
  const to = typeof body?.to === "string" && body.to.trim() ? body.to.trim() : date;
  const handles = normalizeHandles(Array.isArray(body?.handicappers) ? body.handicappers : []);
  const tiktok = body?.tiktok === true;

  if (!PLAIN_DATE.test(date)) {
    return NextResponse.json({ error: "Pick a date." }, { status: 400 });
  }
  if (mode === "winners" && (!PLAIN_DATE.test(to) || to < date)) {
    return NextResponse.json(
      { error: "The end of the span has to be on or after the start." },
      { status: 400 }
    );
  }

  // Check there is something to render before spending a runner on it. The
  // renderer exits quietly on an empty day, which from the admin's side looks
  // identical to a job that silently did nothing — so the emptiness is better
  // said here, immediately, with the reason.
  const payload =
    mode === "winners" ? await winnersFor(date, to, handles) : await recapFor(date, handles);
  if (payload.totals.settled === 0) {
    return NextResponse.json(
      {
        error: handles.length
          ? `Nothing settled for ${handles.map((h) => `@${h}`).join(", ")} in that period, so there is nothing to put in a video.`
          : "Nothing settled in that period, so there is nothing to put in a video.",
      },
      { status: 409 }
    );
  }
  if (mode === "winners" && payload.rows.length === 0) {
    return NextResponse.json(
      { error: "No winning picks in that period — a winners reel would be empty." },
      { status: 409 }
    );
  }

  const config = recapDispatchConfig();
  if (!config.ready) {
    return NextResponse.json(
      {
        error: `Rendering isn't wired up from here yet — ${config.missing} is not set. You can still start it from the repository's Actions tab.`,
        setup: config.missing,
      },
      { status: 503 }
    );
  }

  const failure = await dispatchRecapRender(config, {
    date,
    mode,
    to: mode === "winners" ? to : undefined,
    handicappers: handles.join(","),
    tiktok,
  });
  if (failure) {
    console.error("Recap dispatch failed:", failure);
    return NextResponse.json({ error: `Couldn't start the render. ${failure}` }, { status: 502 });
  }

  await logAdmin(
    ctx.session,
    "recap.render",
    "RecapVideo",
    payload.date,
    `${mode}; ${payload.totals.settled} settled${handles.length ? `; ${handles.join(", ")}` : ""}${tiktok ? "; to TikTok drafts" : ""}`
  );

  return NextResponse.json({
    ok: true,
    key: payload.date,
    label: payload.label,
    settled: payload.totals.settled,
  });
}
