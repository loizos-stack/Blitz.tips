/**
 * Renders the Supercapper video ads for X to public/marketing/.
 *
 *   npm run build                     # supplies the brand webfont
 *   node scripts/build-x-videos.mjs
 *
 * Two cuts, because X's timeline treats them differently:
 *
 *   16:9  1920x1080  the standard in-feed video — renders full width on
 *                    desktop, never letterboxed, and is what a link-card
 *                    preview expects.
 *   1:1   1080x1080  square takes noticeably more vertical space in a phone
 *                    timeline than 16:9 does, so it's the mobile-first cut.
 *
 * Both are silent and text-driven on purpose. X autoplays muted, so a video
 * that needs sound to make sense makes no sense to most of the people who see
 * it — every claim here is on screen. They're also short (12s and 9s): the
 * timeline is a scroll, and a loop that comes back around beats one that runs
 * long enough to be swiped past.
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
const FPS = 30;

// The contest's own numbers. These are claims — if the pool or the window
// changes in the admin panel, re-run this and replace anything already
// scheduled. A stale figure outliving the change is what gets screenshotted
// back at you.
const POOL = 10000;
const STARTS = "Aug 3 2026";
const ENDS = "Jan 10 2027";
const URL = "blitz.tips/supercapper";

mkdirSync(OUT, { recursive: true });

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

// The bolt is the "S" of Supercapper, copied from SupercapperLogo. If the logo
// changes, update both.
const BOLT = `<svg viewBox="10.5 5.5 19 30.5" class="bolt" fill="none">
  <path d="M22 6 L11 23 H18.5 L16 35 L29 19 H21.5 L24 6 Z" fill="#eab308" stroke="#ca8a04"
        stroke-width="1" stroke-linejoin="round"/>
</svg>`;

/** The wordmark. `sub` adds the "Handicapping Contest" line beneath. */
const wordmark = (size, sub = true) => `
  <span class="wm" style="font-size:${size}">
    <span class="wm-row">${BOLT}<span>uper</span><span class="green">capper</span></span>
    ${sub ? '<span class="wm-sub">Handicapping Contest</span>' : ""}
  </span>`;

// The Blitz.tips byline. The wordmark is one flex child, not two — a gap
// between "Blitz" and ".tips" renders as "Blitz .tips".
const byline = `<span class="byline"><img src="${logoMark}" alt=""/><span>Blitz<span class="green">.tips</span></span></span>`;

const baseCss = (w, h) => `
@font-face{font-family:'Space Grotesk';src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:300 700;font-display:block}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${w}px;height:${h}px;overflow:hidden;background:#0b0f14}
body{font-family:'Space Grotesk',sans-serif;color:#fff}
#stage{position:relative;width:${w}px;height:${h}px;overflow:hidden}
.bg{position:absolute;inset:0;
  background:radial-gradient(110% 70% at 50% 0%, rgba(34,197,94,.20), transparent 60%),
             radial-gradient(90% 60% at 85% 100%, rgba(234,179,8,.18), transparent 60%)}
.grid{position:absolute;inset:-20%;opacity:.5;
  background-image:linear-gradient(rgba(255,255,255,.05) 2px,transparent 2px),
                   linear-gradient(90deg,rgba(255,255,255,.05) 2px,transparent 2px);
  background-size:120px 120px;
  mask-image:radial-gradient(circle at 50% 45%,#000 25%,transparent 78%)}
.scene{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
  justify-content:center;text-align:center;will-change:opacity,transform}
.green{color:#22c55e}
.wm{display:inline-flex;flex-direction:column;line-height:1;font-weight:800;letter-spacing:-.02em}
.wm-row{display:inline-flex;align-items:center}
.bolt{height:1.5em;width:.94em;transform:rotate(20deg)}
.wm-sub{margin-top:.14em;align-self:center;font-size:.185em;font-weight:600;text-transform:uppercase;
  letter-spacing:.34em;opacity:.85}
.kicker{font-weight:700;text-transform:uppercase;color:#22c55e}
.pool{font-weight:800;letter-spacing:-.04em;line-height:.9;
  background:linear-gradient(180deg,#fde68a,#eab308 55%,#ca8a04);
  -webkit-background-clip:text;background-clip:text;color:transparent}
.sub{color:#cbd5e1;font-weight:500;line-height:1.4}
.pill{display:inline-flex;align-items:center;border:2px solid rgba(255,255,255,.22);
  border-radius:999px;font-weight:600;color:#e2e8f0}
.line{display:flex;align-items:center;font-weight:600;text-align:left}
.tick{display:flex;align-items:center;justify-content:center;border-radius:999px;
  background:rgba(34,197,94,.18);color:#22c55e;font-weight:800;flex:0 0 auto}
.url{font-weight:800}
.byline{display:inline-flex;align-items:center;gap:.35em;font-weight:700;opacity:.9}
.byline img{height:1.1em;width:1.1em}
`;

// Shared timeline helpers. `seg` is an eased 0->1 ramp; `show` fades a scene in
// and (optionally) out, with a small rise on entry so it reads as poise rather
// than a cut.
const TIMELINE_JS = `
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ease=(p)=>1-Math.pow(1-clamp(p,0,1),3);
const seg=(t,from,dur)=>ease((t-from)/dur);
function show(el,t,inAt,outAt){
  const fadeIn=seg(t,inAt,0.4);
  const fadeOut=outAt==null?0:seg(t,outAt,0.3);
  const o=clamp(fadeIn-fadeOut,0,1);
  el.style.opacity=o;
  const y=(1-fadeIn)*48-fadeOut*40;
  el.style.transform='translateY('+y+'px)';
  return o;
}
function drift(t,px){
  document.getElementById('grid').style.transform='translate('+(-t*px)+'px,'+(-t*px*0.6)+'px)';
}
function countUp(el,t,from,dur,target){
  el.textContent='$'+Math.round(target*seg(t,from,dur)).toLocaleString('en-US');
}
`;

/**
 * The 16:9 cut. Wide framing, so the money scene sets the prize beside the
 * qualifier rather than stacking them, and the steps run as one row.
 */
const landscape = {
  name: "supercapper-x-16x9-1920x1080.mp4",
  w: 1920,
  h: 1080,
  duration: 12,
  html: `
  <div class="scene" id="s1">${wordmark("140px")}</div>

  <div class="scene" id="s2">
    <div class="kicker" style="font-size:30px;letter-spacing:.3em">Guaranteed prize pool</div>
    <div class="pool" id="pool" style="font-size:250px;margin-top:18px">$0</div>
    <div class="sub" style="font-size:40px;margin-top:10px">Free to enter · every pick graded in public</div>
  </div>

  <div class="scene" id="s3">
    <div class="kicker" style="font-size:30px;letter-spacing:.3em">How it works</div>
    <div style="display:flex;gap:180px;margin-top:66px">
      <div class="line" style="flex-direction:column;gap:28px;text-align:center;font-size:46px">
        <span class="tick" style="width:96px;height:96px;font-size:44px">1</span><span>Post your picks</span>
      </div>
      <div class="line" style="flex-direction:column;gap:28px;text-align:center;font-size:46px">
        <span class="tick" style="width:96px;height:96px;font-size:44px">2</span><span>Graded in public</span>
      </div>
      <div class="line" style="flex-direction:column;gap:28px;text-align:center;font-size:46px">
        <span class="tick" style="width:96px;height:96px;font-size:44px">3</span><span>Best ROI wins</span>
      </div>
    </div>
  </div>

  <div class="scene" id="s4">
    ${wordmark("96px")}
    <div class="pill" style="font-size:34px;padding:16px 40px;gap:14px;margin-top:44px">${STARTS} → ${ENDS}</div>
    <div class="url" style="font-size:56px;margin-top:34px">${URL}</div>
    <div style="margin-top:30px;font-size:32px">${byline}</div>
  </div>`,
  render: `
  drift(t,12);
  show(document.getElementById('s1'),t,0.15,2.2);
  show(document.getElementById('s2'),t,2.5,5.6);
  show(document.getElementById('s3'),t,5.9,8.2);
  show(document.getElementById('s4'),t,8.5,null);
  countUp(document.getElementById('pool'),t,2.6,1.4,${POOL});`,
};

/**
 * The 1:1 cut. Square eats more of a phone timeline, so this one is the
 * hook-first version: the number, the price of entry, the link. Nothing else.
 */
const square = {
  name: "supercapper-x-square-1080.mp4",
  w: 1080,
  h: 1080,
  duration: 9,
  html: `
  <div class="scene" id="s1">
    <div class="kicker" style="font-size:26px;letter-spacing:.3em">Guaranteed prize pool</div>
    <div class="pool" id="pool" style="font-size:210px;margin-top:16px">$0</div>
    <div class="sub" style="font-size:40px;margin-top:14px">Free to enter</div>
  </div>

  <div class="scene" id="s2">
    ${wordmark("104px")}
    <div class="sub" style="font-size:38px;margin-top:40px;padding:0 80px">
      Post picks. Every one graded in public.<br/><span class="green">Best ROI wins.</span>
    </div>
    <div class="pill" style="font-size:30px;padding:14px 34px;margin-top:40px">${STARTS} → ${ENDS}</div>
  </div>

  <div class="scene" id="s3">
    <div class="url" style="font-size:52px">${URL}</div>
    <div class="sub" style="font-size:34px;margin-top:20px">Free to enter · ${POOL.toLocaleString("en-US")} guaranteed</div>
    <div style="margin-top:44px;font-size:30px">${byline}</div>
  </div>`,
  render: `
  drift(t,10);
  show(document.getElementById('s1'),t,0.15,3.2);
  show(document.getElementById('s2'),t,3.5,6.0);
  show(document.getElementById('s3'),t,6.3,null);
  countUp(document.getElementById('pool'),t,0.3,1.5,${POOL});`,
};

function pageHtml(spec) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${baseCss(spec.w, spec.h)}</style></head>
<body><div id="stage"><div class="bg"></div><div class="grid" id="grid"></div>${spec.html}</div>
<script>${TIMELINE_JS}
window.render=function(t){${spec.render}};
window.render(0);
</script></body></html>`;
}

async function renderVideo(chromium, spec) {
  const frames = join(tmpdir(), `x-video-${spec.w}x${spec.h}`);
  rmSync(frames, { recursive: true, force: true });
  mkdirSync(frames, { recursive: true });

  const htmlPath = join(tmpdir(), `x-video-${spec.w}x${spec.h}.html`);
  writeFileSync(htmlPath, pageHtml(spec));

  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? undefined });
  const page = await browser.newPage({ viewport: { width: spec.w, height: spec.h } });
  await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);

  const total = FPS * spec.duration;
  for (let i = 0; i < total; i++) {
    await page.evaluate((t) => window.render(t), i / FPS);
    await page.screenshot({ path: join(frames, `f${String(i).padStart(4, "0")}.jpg`), type: "jpeg", quality: 92 });
    if (i % 60 === 0) console.log(`  ${spec.name} frame ${i}/${total}`);
  }
  await browser.close();

  const out = join(OUT, spec.name);
  execFileSync(
    ffmpegPath(),
    [
      "-y",
      "-framerate", String(FPS),
      "-i", join(frames, "f%04d.jpg"),
      "-c:v", "libx264",
      "-preset", "slow",
      "-crf", "20",
      // yuv420p or it won't play on iOS and most social apps.
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      out,
    ],
    { stdio: "inherit" }
  );
  rmSync(frames, { recursive: true, force: true });
  console.log(`${out}\n`);
}

const chromium = await loadChromium();
for (const spec of [landscape, square]) await renderVideo(chromium, spec);
