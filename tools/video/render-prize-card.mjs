/**
 * Render the monthly-prize card for X.
 *
 *   node tools/video/render-prize-card.mjs <out.png>
 *
 * The 16:9 still that goes with render-prize-promo.mjs next door. Same reason
 * for existing: when the prize figures change, both re-render from one edit
 * rather than someone hunting for the image with the old numbers in it.
 *
 * Needs Chromium.
 */
import { chromium } from "playwright-core";
import { statSync } from "node:fs";
import path from "node:path";

const SCENE = path.join(import.meta.dirname, "prize-card-scene.html");
const out = process.argv[2];
if (!out) {
  console.error("usage: render-prize-card.mjs <out.png>");
  process.exit(2);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox", "--force-device-scale-factor=1"],
});
// 1600x900 — X's 16:9 slot, large enough that the headline stays crisp when
// the timeline scales it down.
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.goto(`file://${SCENE}`, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out });
await browser.close();

const { size } = statSync(out);
console.log(`${out} — ${(size / 1e3).toFixed(0)}KB, 1600x900`);
