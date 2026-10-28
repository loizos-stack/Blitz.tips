/**
 * Render the results-recap video for one day.
 *
 *   node tools/video/render-recap.mjs <payload.json> <out.mp4>
 *
 * The payload is whatever GET /api/cron/recap returned. Frames are pulled by
 * calling seek(t) rather than letting the page animate, so a slow machine
 * produces exactly the same video as a fast one.
 *
 * Needs Chromium and ffmpeg, which is why this runs on a GitHub Actions runner
 * rather than in the Vercel function — see .github/workflows/recap-video.yml.
 */
import { chromium } from "playwright-core";
import { mkdirSync, rmSync, readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const SCENE = path.join(import.meta.dirname, "recap-scene.html");
const payloadPath = process.argv[2];
const out = process.argv[3];

if (!payloadPath || !out) {
  console.error("usage: render-recap.mjs <payload.json> <out.mp4>");
  process.exit(2);
}

const data = JSON.parse(readFileSync(payloadPath, "utf8"));

// Nothing settled means there is no recap to publish. Exit 3 so the workflow
// can tell "quiet day" apart from "the renderer broke".
if (!data.totals || data.totals.settled === 0) {
  console.log(`No settled picks for ${data.date} — nothing to render.`);
  process.exit(3);
}

const FPS = 30;
const DURATION_MS = 9000;
const TOTAL = Math.round((DURATION_MS / 1000) * FPS);

const frames = path.join(os.tmpdir(), `recap-frames-${data.date}`);
rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox", "--force-device-scale-factor=1"],
});
// 1080x1920 is the native 9:16. Anything else gets cropped by the app, and a
// crop moves the safe area out from under the text.
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto(`file://${SCENE}`, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.evaluate((d) => window.load(d), data);

process.stdout.write(`rendering ${TOTAL} frames `);
for (let i = 0; i < TOTAL; i++) {
  await page.evaluate((t) => window.seek(t), (i / FPS) * 1000);
  await page.screenshot({
    path: path.join(frames, `f${String(i).padStart(4, "0")}.png`),
    animations: "disabled",
  });
  if (i % 30 === 0) process.stdout.write(".");
}
console.log(" done");
await browser.close();

execFileSync(
  "ffmpeg",
  [
    "-y", "-loglevel", "error",
    "-framerate", String(FPS),
    "-i", path.join(frames, "f%04d.png"),
    // yuv420p and an even frame size, or it will not open on an iPhone.
    "-c:v", "libx264", "-pix_fmt", "yuv420p",
    "-profile:v", "high", "-level", "4.2",
    // CRF 20 keeps a 9s 1080x1920 clip comfortably under the 4MB the upload
    // endpoint accepts, with no visible cost on flat UI colour.
    "-crf", "20",
    // Index at the front, so the upload previews immediately.
    "-movflags", "+faststart",
    out,
  ],
  { stdio: "inherit" }
);

rmSync(frames, { recursive: true, force: true });

const { size } = statSync(out);
console.log(`${out} — ${(size / 1e6).toFixed(2)}MB, ${data.totals.record}, ${data.totals.units}u`);
if (size > 4 * 1024 * 1024) {
  console.error("::error::Over the 4MB upload limit — raise -crf and re-render.");
  process.exit(4);
}
