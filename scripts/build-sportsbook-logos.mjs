/**
 * Prepares the 1win wordmark files in public/, in the same two-file shape Stake
 * uses: a dark version for light surfaces and a white knockout for dark ones.
 *
 * ## Preferred: point it at the official artwork
 *
 *   node scripts/build-sportsbook-logos.mjs --from ~/Downloads/1win.png
 *
 * Takes 1win's own file (PNG with transparency), installs it as
 * public/1win-logo.png, derives the white knockout by forcing RGB to white
 * while preserving alpha — the same trick behind Stake's two files — and prints
 * the aspect ratio to paste into LOGO_RATIO in components/sportsbook-cta.tsx.
 *
 * ## Fallback: render a stand-in
 *
 *   npm run build                            # supplies the brand webfont
 *   node scripts/build-sportsbook-logos.mjs
 *
 * With no --from, it sets "1win" in the site's own brand font. That is a
 * placeholder, not their artwork, and should be replaced as soon as the real
 * file is to hand.
 *
 * Both paths end the same way: two files in public/ and one number to update.
 */
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "fs";
import { execFileSync } from "child_process";
import { createRequire } from "module";
import { tmpdir } from "os";
import { join } from "path";

const ROOT = process.cwd();
const OUT = join(ROOT, "public");

// 4x the rendered size, so the downscaled result stays crisp on retina.
const SCALE = 4;
const W = 300;
const H = 110;

mkdirSync(OUT, { recursive: true });

async function loadChromium() {
  try {
    return (await import("playwright")).chromium;
  } catch {
    const globalModules = process.env.PLAYWRIGHT_NODE_MODULES ?? "/opt/node22/lib/node_modules/";
    return createRequire(globalModules)("playwright").chromium;
  }
}

function brandFont() {
  const media = join(ROOT, ".next/static/media");
  const files = readdirSync(media).filter((f) => f.endsWith(".woff2"));
  if (files.length === 0) throw new Error("No .woff2 in .next/static/media — run `npm run build` first.");
  const biggest = files
    .map((f) => ({ f, size: statSync(join(media, f)).size }))
    .sort((a, b) => b.size - a.size)[0].f;
  return readFileSync(join(media, biggest)).toString("base64");
}

const font = brandFont();

/** Transparent background so the mark drops onto any surface, like Stake's. */
const page = (color) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Space Grotesk';src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:300 700;font-display:block}
*{margin:0;padding:0}
html,body{width:${W}px;height:${H}px;background:transparent}
/* Sized to the glyphs, not to the canvas. The element is screenshotted rather
   than the viewport, so the exported file has no baked-in padding — otherwise
   the whitespace shows up as an oversized gap next to the "Bet on" label. */
#m{display:inline-block;font-family:'Space Grotesk',sans-serif;font-weight:700;
   font-size:82px;letter-spacing:-.045em;color:${color};line-height:1}
</style></head><body><div id="m">1win</div></body></html>`;

let ratio = W / H;

// --- Official artwork path -------------------------------------------------

const fromArg = process.argv.indexOf("--from");
if (fromArg !== -1) {
  const src = process.argv[fromArg + 1];
  if (!src || !existsSync(src)) {
    console.error(`--from needs a path to an existing image (got: ${src ?? "nothing"})`);
    process.exit(1);
  }

  const dark = join(OUT, "1win-logo.png");
  copyFileSync(src, dark);

  // White knockout: force every pixel white and keep the original alpha, so the
  // mark stays legible on dark surfaces. Anything without transparency will
  // come out as a solid white block — that is the signal the source needs a
  // transparent background, not a bug here.
  const white = join(OUT, "1win-logo-white.png");
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-i", dark,
    "-vf", "format=rgba,geq=r='255':g='255':b='255':a='alpha(X,Y)'",
    white,
  ]);

  const dims = execFileSync("ffprobe", [
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", dark,
  ]).toString().trim();
  const [w, h] = dims.split("x").map(Number);

  console.log(`${dark}   ${w}x${h}  (from ${src})`);
  console.log(`${white}   white knockout`);
  console.log(`\nSet LOGO_RATIO in components/sportsbook-cta.tsx to ${(w / h).toFixed(4)}`);
  process.exit(0);
}

// --- Stand-in path ---------------------------------------------------------

const chromium = await loadChromium();
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? undefined });

for (const [name, color] of [
  ["1win-logo.png", "#13161c"],
  ["1win-logo-white.png", "#ffffff"],
]) {
  const p = join(tmpdir(), `1win-${name}.html`);
  writeFileSync(p, page(color));

  const tab = await browser.newPage({
    viewport: { width: W, height: H },
    deviceScaleFactor: SCALE,
  });
  await tab.goto(`file://${p}`, { waitUntil: "load" });
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForTimeout(200);

  // Playwright writes png/jpeg only, so shoot a transparent PNG and convert.
  // libwebp keeps the alpha channel, which the knockout version depends on.
  // PNG, not WebP. ffmpeg's libwebp encoder writes a VP8X container that Next's
  // image optimizer reads as animated — it then refuses to optimize the file and
  // logs a warning on every request. Next converts PNG to WebP/AVIF itself via
  // images.formats, so shipping PNG loses nothing and avoids the trap entirely.
  const out = join(OUT, name);
  const mark = tab.locator("#m");
  await mark.screenshot({ path: out, type: "png", omitBackground: true });
  const box = await mark.boundingBox();
  ratio = box.width / box.height;
  await tab.close();
  console.log(`${out}  ratio ${ratio.toFixed(4)}`);
}

await browser.close();
console.log(`\nSet LOGO_RATIO in components/sportsbook-cta.tsx to ${ratio.toFixed(4)}`);
