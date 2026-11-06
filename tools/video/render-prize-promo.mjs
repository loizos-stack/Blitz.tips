/**
 * Render the monthly-prize promo video.
 *
 *   node tools/video/render-prize-promo.mjs <out.mp4>
 *
 * Same method as render-recap.mjs next door — frames pulled by calling seek(t)
 * rather than letting the page animate, so the output is identical on any
 * machine — but this one takes no payload. The prize is a fixed announcement,
 * not a nightly figure, so there is nothing to fetch and nothing to go stale
 * until the amounts change.
 *
 * Needs Chromium and ffmpeg.
 */
import { chromium } from "playwright-core";
import { mkdirSync, rmSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const SCENE = path.join(import.meta.dirname, "prize-scene.html");
const out = process.argv[2];
if (!out) {
  console.error("usage: render-prize-promo.mjs <out.mp4>");
  process.exit(2);
}

const FPS = 30;
// Long enough to read the rule line, short enough to loop on TikTok without
// feeling like it stalled on the last frame.
const DURATION_MS = 7000;
const TOTAL = Math.round((DURATION_MS / 1000) * FPS);

const frames = path.join(os.tmpdir(), "prize-promo-frames");
rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox", "--force-device-scale-factor=1"],
});
// 1080x1920 native 9:16 — the format TikTok, Reels and Shorts all want, and
// the one the recap pipeline already produces.
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto(`file://${SCENE}`, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);

process.stdout.write(`rendering ${TOTAL} frames `);
for (let i = 0; i < TOTAL; i++) {
  await page.evaluate((t) => window.seek(t), i / FPS);
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
    "-crf", "20",
    "-movflags", "+faststart",
    out,
  ],
  { stdio: "inherit" }
);

rmSync(frames, { recursive: true, force: true });
const { size } = statSync(out);
console.log(`${out} — ${(size / 1e6).toFixed(2)}MB, ${DURATION_MS / 1000}s @ ${FPS}fps`);
