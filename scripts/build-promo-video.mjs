/**
 * Renders the vertical Supercapper promo video to public/marketing/.
 *
 *   npm run build                        # supplies the brand webfont
 *   node scripts/build-promo-video.mjs
 *
 * 1080x1920 (9:16) for TikTok / Reels / Shorts. Silent by design — creators
 * add trending audio on the platform, and a baked-in track is both a licensing
 * problem and the first thing they'd mute.
 *
 * Frames are driven by an explicit clock rather than CSS animations, so the
 * output is deterministic: frame N is identical on every run regardless of how
 * fast the machine renders.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync } from "fs";
import { createRequire } from "module";
import { execFileSync } from "child_process";
import { tmpdir } from "os";
import { join } from "path";

const ROOT = process.cwd();
const OUT = join(ROOT, "public/marketing");
const FRAMES = join(tmpdir(), "supercapper-frames");
const W = 1080;
const H = 1920;
const FPS = 30;
const DURATION = 13; // seconds
const TOTAL = FPS * DURATION;

mkdirSync(OUT, { recursive: true });
rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });

async function loadChromium() {
  try {
    return (await import("playwright")).chromium;
  } catch {
    const globalModules = process.env.PLAYWRIGHT_NODE_MODULES ?? "/opt/node22/lib/node_modules/";
    return createRequire(globalModules)("playwright").chromium;
  }
}

function ffmpegPath() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    // imageio-ffmpeg ships a static build; use it when a system ffmpeg is absent.
    return execFileSync("python3", [
      "-c",
      "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())",
    ])
      .toString()
      .trim();
  } catch {
    return "ffmpeg";
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
const logoMark =
  "data:image/svg+xml;base64," +
  Buffer.from(readFileSync(join(ROOT, "public/logo-mark.svg"), "utf8")).toString("base64");

const page_html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Space Grotesk';src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:300 700;font-display:block}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#0b0f14}
body{font-family:'Space Grotesk',sans-serif;color:#fff}
#stage{position:relative;width:${W}px;height:${H}px;overflow:hidden}
.bg{position:absolute;inset:0;
  background:radial-gradient(120% 60% at 50% 0%, rgba(34,197,94,.20), transparent 60%),
             radial-gradient(90% 50% at 80% 100%, rgba(234,179,8,.18), transparent 60%)}
.grid{position:absolute;inset:-20%;opacity:.5;
  background-image:linear-gradient(rgba(255,255,255,.05) 2px,transparent 2px),
                   linear-gradient(90deg,rgba(255,255,255,.05) 2px,transparent 2px);
  background-size:120px 120px;
  mask-image:radial-gradient(circle at 50% 45%,#000 25%,transparent 75%)}
.scene{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
  justify-content:center;text-align:center;padding:0 90px;will-change:opacity,transform}
.green{color:#22c55e}.gold{color:#eab308}
.wm{display:inline-flex;flex-direction:column;line-height:1;font-weight:800;letter-spacing:-.02em}
.wm-row{display:inline-flex;align-items:center}
.bolt{height:1.5em;width:.94em;transform:rotate(20deg)}
.wm-sub{margin-top:.14em;align-self:center;font-size:.185em;font-weight:600;text-transform:uppercase;
  letter-spacing:.34em;opacity:.85}
.kicker{font-weight:700;text-transform:uppercase;letter-spacing:.32em;color:#22c55e;font-size:34px}
.pool{font-weight:800;letter-spacing:-.04em;line-height:.9;font-size:230px;
  background:linear-gradient(180deg,#fde68a,#eab308 55%,#ca8a04);
  -webkit-background-clip:text;background-clip:text;color:transparent}
.big{font-size:104px;font-weight:800;letter-spacing:-.03em;line-height:1.05}
.sub{font-size:42px;color:#cbd5e1;font-weight:500;line-height:1.4}
.pill{display:inline-flex;align-items:center;gap:16px;border:2px solid rgba(255,255,255,.22);
  border-radius:999px;padding:18px 40px;font-size:34px;font-weight:600;color:#e2e8f0}
.line{display:flex;align-items:center;gap:22px;font-size:44px;font-weight:600;text-align:left}
.tick{display:flex;align-items:center;justify-content:center;width:56px;height:56px;flex:0 0 56px;
  border-radius:999px;background:rgba(34,197,94,.18);color:#22c55e;font-size:32px;font-weight:800}
.url{font-size:52px;font-weight:800}
.byline{display:inline-flex;align-items:center;gap:14px;font-size:34px;font-weight:700;opacity:.9}
.byline img{height:1.1em;width:1.1em}
</style></head><body>
<div id="stage">
  <div class="bg"></div>
  <div class="grid" id="grid"></div>

  <div class="scene" id="s1">
    <span class="wm" style="font-size:150px">
      <span class="wm-row">
        <svg viewBox="10.5 5.5 19 30.5" class="bolt" id="bolt" fill="none">
          <path d="M22 6 L11 23 H18.5 L16 35 L29 19 H21.5 L24 6 Z" fill="#eab308" stroke="#ca8a04"
                stroke-width="1" stroke-linejoin="round"/>
        </svg><span id="w1">uper</span><span class="green" id="w2">capper</span>
      </span>
      <span class="wm-sub" id="w3">Handicapping Contest</span>
    </span>
  </div>

  <div class="scene" id="s2">
    <div class="kicker">Guaranteed prize pool</div>
    <div class="pool" id="pool" style="margin-top:30px">$0</div>
    <div class="sub" style="margin-top:20px">Free to enter</div>
  </div>

  <div class="scene" id="s3" style="gap:46px;align-items:flex-start;text-align:left">
    <div class="line"><span class="tick">1</span><span>Post your picks</span></div>
    <div class="line"><span class="tick">2</span><span>Every one graded in&nbsp;public</span></div>
    <div class="line"><span class="tick">3</span><span>Best ROI wins</span></div>
  </div>

  <div class="scene" id="s4">
    <div class="big">No Discord.<br/>No screenshots.<br/><span class="green">Just a record.</span></div>
  </div>

  <div class="scene" id="s5">
    <span class="wm" style="font-size:92px">
      <span class="wm-row">
        <svg viewBox="10.5 5.5 19 30.5" class="bolt" fill="none">
          <path d="M22 6 L11 23 H18.5 L16 35 L29 19 H21.5 L24 6 Z" fill="#eab308" stroke="#ca8a04"
                stroke-width="1" stroke-linejoin="round"/>
        </svg><span>uper</span><span class="green">capper</span>
      </span>
      <span class="wm-sub">Handicapping Contest</span>
    </span>
    <div class="pill" style="margin-top:52px">Aug 3 2026 → Jan 10 2027</div>
    <div class="url" style="margin-top:46px">blitz.tips/supercapper</div>
    <div class="byline" style="margin-top:38px"><img src="${logoMark}" alt=""/><span>Blitz<span class="green">.tips</span></span></div>
  </div>
</div>

<script>
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Ease-out cubic: motion that arrives and settles, rather than linear drift.
const ease = (p) => 1 - Math.pow(1 - clamp(p, 0, 1), 3);
// Window helper: 0 before \`from\`, eased 0→1 across \`dur\`, 1 after.
const seg = (t, from, dur) => ease((t - from) / dur);

function show(el, t, inAt, outAt) {
  const fadeIn = seg(t, inAt, 0.45);
  const fadeOut = outAt == null ? 0 : seg(t, outAt, 0.35);
  const o = clamp(fadeIn - fadeOut, 0, 1);
  el.style.opacity = o;
  // Rise on entry, lift away on exit — small, so it reads as poise not bounce.
  const y = (1 - fadeIn) * 60 - fadeOut * 50;
  el.style.transform = 'translateY(' + y + 'px)';
  el.style.pointerEvents = 'none';
  return o;
}

window.render = function (t) {
  document.getElementById('grid').style.transform =
    'translate(' + (-t * 14) + 'px,' + (-t * 9) + 'px)';

  show(document.getElementById('s1'), t, 0.15, 2.7);
  show(document.getElementById('s2'), t, 3.0, 6.0);
  show(document.getElementById('s3'), t, 6.3, 8.9);
  show(document.getElementById('s4'), t, 9.2, 10.9);
  show(document.getElementById('s5'), t, 11.2, null);

  // The bolt strikes in ahead of the wordmark.
  const strike = seg(t, 0.15, 0.6);
  const bolt = document.getElementById('bolt');
  bolt.style.transform = 'rotate(' + (20 + (1 - strike) * 45) + 'deg) scale(' + (0.5 + strike * 0.5) + ')';
  bolt.style.opacity = strike;
  // Then the two halves of the word.
  document.getElementById('w1').style.opacity = seg(t, 0.5, 0.5);
  document.getElementById('w2').style.opacity = seg(t, 0.75, 0.5);
  document.getElementById('w3').style.opacity = seg(t, 1.1, 0.5);

  // Prize counts up — the number earning its size rather than just appearing.
  const p = seg(t, 3.1, 1.5);
  const value = Math.round(10000 * p);
  document.getElementById('pool').textContent = '$' + value.toLocaleString('en-US');
};
window.render(0);
</script>
</body></html>`;

const htmlPath = join(tmpdir(), "supercapper-promo.html");
writeFileSync(htmlPath, page_html);

const chromium = await loadChromium();
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? undefined });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);

for (let i = 0; i < TOTAL; i++) {
  await page.evaluate((t) => window.render(t), i / FPS);
  await page.screenshot({
    path: join(FRAMES, `f${String(i).padStart(4, "0")}.jpg`),
    type: "jpeg",
    quality: 92,
  });
  if (i % 60 === 0) console.log(`  frame ${i}/${TOTAL}`);
}
await browser.close();

const out = join(OUT, "supercapper-promo-1080x1920.mp4");
execFileSync(
  ffmpegPath(),
  [
    "-y",
    "-framerate", String(FPS),
    "-i", join(FRAMES, "f%04d.jpg"),
    "-c:v", "libx264",
    "-preset", "slow",
    "-crf", "20",
    // yuv420p or it won't play on iOS/most social apps.
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    out,
  ],
  { stdio: "inherit" }
);
rmSync(FRAMES, { recursive: true, force: true });
console.log(`\n${out}`);
