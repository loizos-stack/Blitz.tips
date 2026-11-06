/**
 * Prepares the 1win wordmark files in public/, in the same two-file shape Stake
 * uses: a dark version for light surfaces and a white knockout for dark ones.
 *
 * ## Preferred: point it at the official artwork
 *
 *   node scripts/build-sportsbook-logos.mjs --from ~/Downloads/1win.png
 *
 * Takes 1win's own file (PNG with transparency), trims its transparent margin,
 * installs it as public/1win-logo.png, derives the dark-surface version by
 * keeping the light parts of the mark and dropping the dark ones, downscales
 * both to delivery size, and prints the aspect ratio to paste into LOGO_RATIO
 * in components/sportsbook-cta.tsx.
 *
 * The master artwork lives at docs/brand/1win-logo-source.png, so the current
 * files can be regenerated without going back to 1win for the asset:
 *
 *   node scripts/build-sportsbook-logos.mjs --from docs/brand/1win-logo-source.png
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
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from "fs";
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

// Alpha at or below this counts as background when trimming the margin.
const ALPHA_FLOOR = 8;
// Splits an outlined mark into its light and dark parts. Mid-grey, so it lands
// between the two tones of a high-contrast wordmark rather than inside either.
const LUMA_SPLIT = 140;
// Delivered height in px. The mark renders at 20-24px and Next serves a
// retina srcset from this, so anything past a few hundred is dead weight.
const DELIVERED_HEIGHT = 320;

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

  const dims = execFileSync("ffprobe", [
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", src,
  ]).toString().trim();
  const [sw, sh] = dims.split("x").map(Number);

  // Decode to raw RGBA so the crop and the knockout can be decided per pixel.
  const rawPath = join(tmpdir(), "1win-src.rgba");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-f", "rawvideo", "-pix_fmt", "rgba", rawPath]);
  const px = readFileSync(rawPath);
  const at = (x, y) => (y * sw + x) * 4;

  // Trim transparent margin. Exported artwork is usually padded, and that
  // padding would render as an oversized gap next to the "Bet on" label while
  // making the mark look smaller than the height it was given.
  let x0 = sw, y0 = sh, x1 = -1, y1 = -1;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if (px[at(x, y) + 3] > ALPHA_FLOOR) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) {
    console.error(`${src} is fully transparent — nothing to install.`);
    process.exit(1);
  }
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;

  // Two buffers on one canvas. Sharing the crop box matters: the component
  // sizes both files from a single LOGO_RATIO, so cropping each to its own
  // content box would stretch one of them.
  const full = Buffer.alloc(cw * ch * 4);
  const white = Buffer.alloc(cw * ch * 4);
  let light = 0;
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const s = at(x + x0, y + y0);
      const d = (y * cw + x) * 4;
      const [r, g, b, a] = [px[s], px[s + 1], px[s + 2], px[s + 3]];
      full[d] = r; full[d + 1] = g; full[d + 2] = b; full[d + 3] = a;

      // The dark-surface version keeps the light parts of the mark and discards
      // the dark ones. Forcing every pixel white and keeping alpha — the
      // obvious approach — only works for a single-colour silhouette; on an
      // outlined mark like 1win's it merges the letterforms with their own
      // outline and drop shadow into one solid white blob.
      const luma = r * 0.299 + g * 0.587 + b * 0.114;
      const keep = luma > LUMA_SPLIT;
      if (keep && a > ALPHA_FLOOR) light++;
      white[d] = 255; white[d + 1] = 255; white[d + 2] = 255; white[d + 3] = keep ? a : 0;
    }
  }

  // A mark that is entirely dark has nothing to keep, so the knockout would
  // come out empty. Fall back to the silhouette, which is the right answer for
  // a single-colour wordmark.
  if (light === 0) {
    for (let i = 0; i < cw * ch; i++) white[i * 4 + 3] = full[i * 4 + 3];
  }

  // Downscale to delivery size. The source is far larger than any rendered
  // height, and lanczos on the full-resolution mask is what gives the edges
  // their antialiasing back after the hard luma split above.
  const outW = Math.round(DELIVERED_HEIGHT * (cw / ch));
  const darkOut = join(OUT, "1win-logo.png");
  const whiteOut = join(OUT, "1win-logo-white.png");
  for (const [buf, out] of [[full, darkOut], [white, whiteOut]]) {
    const tmp = join(tmpdir(), "1win-stage.rgba");
    writeFileSync(tmp, buf);
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error",
      "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${cw}x${ch}`, "-i", tmp,
      "-vf", `scale=${outW}:${DELIVERED_HEIGHT}:flags=lanczos`, "-frames:v", "1", out,
    ]);
  }

  console.log(`${src}  ${sw}x${sh} -> cropped ${cw}x${ch} -> ${outW}x${DELIVERED_HEIGHT}`);
  console.log(`${darkOut}   full mark, for light surfaces`);
  console.log(`${whiteOut}   ${light === 0 ? "white silhouette" : "light parts of the mark only"}, for dark surfaces`);
  console.log(`\nSet LOGO_RATIO in components/sportsbook-cta.tsx to ${(cw / ch).toFixed(4)}`);
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
