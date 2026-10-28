# Promo video rendering

Vertical (1080×1920) MP4s rendered from site data, for TikTok / Reels / Shorts.

There is no video library here. A page is animated in headless Chromium, each
frame is screenshotted, and ffmpeg encodes the sequence — which is why this runs
on a GitHub Actions runner and not in the Vercel function: the runtime has
neither a browser nor ffmpeg.

## The nightly results recap

`.github/workflows/recap-video.yml` runs at 09:20 UTC and:

1. `GET /api/cron/recap` — the previous UTC day's settled picks (`src/lib/recap.ts`)
2. `node tools/video/render-recap.mjs payload.json recap.mp4`
3. `POST /api/cron/recap?date=…` with the MP4, which stores it in Blob and
   records a `RecapVideo` row

It then shows up in **Admin → Recaps** to download.

Re-running is safe: one video per day, overwritten in place.

## Running it by hand

From the repo root:

```bash
npm i --no-save playwright@1.56.1
npx playwright install chromium            # skip if a browser is already present

curl -H "Authorization: Bearer $CRON_SECRET" \
     "https://blitz.tips/api/cron/recap?date=2026-10-27" > payload.json

node tools/video/render-recap.mjs payload.json recap.mp4
```

`CHROMIUM_PATH` overrides the browser binary if Playwright's own copy isn't the
one you want.

Exit codes: **3** means nothing settled that day (not a failure — the workflow
ends green and publishes nothing), **4** means the file came out over the 4MB
the upload endpoint accepts, so raise `-crf` in the script.

## Editing the look

`recap-scene.html` is a normal page: open it in a browser, call
`load(payload)` then `seek(t)` from the console to inspect any moment.

Two rules it has to keep:

- **Every animation is a function of `t`.** Frames are captured far slower than
  real time, so a CSS animation or anything reading the wall clock smears
  across the capture. `seek(2500)` must always draw the same frame.
- **The totals describe the whole day; the rows do not.** Six rows fit legibly
  and a busy day settles more, so the headline figure is computed from every
  settled pick and `omitted` is displayed whenever rows are left out. Showing
  only the six best would be a highlight reel of a day that might have lost
  money — see the note at the top of `src/lib/recap.ts`.

## Adding another template

Copy the pair: a `*-scene.html` with `load()` and `seek()`, and a render script
that feeds it. Both the frame loop and the ffmpeg flags in `render-recap.mjs`
are worth copying as-is — `yuv420p`, an even frame size and `+faststart` are
what make the file play on an iPhone and preview instantly on upload.
