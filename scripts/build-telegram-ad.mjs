/**
 * Renders the Blitz.tips logo sting for Telegram ad campaigns.
 *
 *   npm run build            # needed once — supplies the brand webfont
 *   node scripts/build-telegram-ad.mjs
 *
 * A bolt strikes in, charges, detonates, and the blast resolves into the
 * Blitz.tips lockup. Silent MP4, which is what Telegram autoplays inline.
 *
 * Drawn on a canvas rather than with DOM elements like the other motion
 * scripts. The blast is ~210 particles and a shockwave, which is a lot of
 * layers to composite, and every frame here has to be a pure function of `t`:
 * the renderer steps time by hand and screenshots, so anything reading a live
 * clock or calling Math.random() per frame would flicker. Particle parameters
 * are drawn once from a seeded PRNG and their positions computed from elapsed
 * time, so the same frame always renders identically.
 *
 * The bolt path and brand colours are copied from public/logo-mark.svg and the
 * site's own wordmark, and the typeface comes out of the Next build, so this
 * can't drift into its own look.
 */
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { execFileSync } from "child_process";
import { createRequire } from "module";
import { tmpdir } from "os";
import { join } from "path";

const ROOT = process.cwd();
const OUT = join(ROOT, "public/marketing");
const FPS = 30;
const DURATION = 4.5;

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
  let files;
  try {
    files = readdirSync(media).filter((f) => f.endsWith(".woff2"));
  } catch {
    throw new Error("No .next/static/media — run `npm run build` first.");
  }
  if (files.length === 0) throw new Error("No .woff2 in .next/static/media — run `npm run build` first.");
  const biggest = files
    .map((f) => ({ f, size: statSync(join(media, f)).size }))
    .sort((a, b) => b.size - a.size)[0].f;
  return readFileSync(join(media, biggest)).toString("base64");
}

const font = brandFont();

// Timeline, in seconds. Named rather than inlined because the phases have to
// overlap precisely — the letters start resolving while the blast is still
// travelling, which is what makes the wordmark read as coming *out* of it.
const T = {
  strikeEnd: 0.45,
  chargeEnd: 1.35,
  blast: 1.35,
  revealStart: 1.58,
  markStart: 2.15,
  fadeStart: 4.2,
};

const SCENE = `
// Bolt path from public/logo-mark.svg, in its own 40x40 viewBox.
const BOLT = new Path2D("M22 6 L11 23 H18.5 L16 35 L29 19 H21.5 L24 6 Z");
const T = ${JSON.stringify(T)};
const GREEN = "#22c55e";
const GOLD_HI = "#fde047";
const GOLD_LO = "#eab308";

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = (u) => 1 - Math.pow(1 - u, 3);
const easeIn = (u) => u * u * u;
// Overshoots then settles — the snap at the end of the strike.
const backOut = (u) => { const c = 1.9; const p = u - 1; return 1 + (c + 1) * p * p * p + c * p * p; };

// Seeded so a given frame always renders identically. The renderer steps time
// by hand, so per-frame randomness would flicker instead of animate.
function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const rand = makeRng(0xb1172);
const PARTICLES = Array.from({ length: 210 }, () => {
  const a = rand() * Math.PI * 2;
  return {
    a,
    // Squared so most particles are slow and a few outrun them — an even
    // spread reads as a mechanical ring rather than a blast.
    speed: 640 + Math.pow(rand(), 2) * 3400,
    size: 4.5 + rand() * 16,
    life: 0.75 + rand() * 0.85,
    spin: (rand() - 0.5) * 14,
    // Mostly the bolt's own gold, a few green to seed the wordmark's colour.
    green: rand() < 0.22,
    // Start spread along the bolt rather than from a single point.
    ox: (rand() - 0.5) * 130,
    oy: (rand() - 0.5) * 270,
  };
});

function drawGrid(ctx, W, H, alpha) {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "rgba(255,255,255,0.055)";
  ctx.lineWidth = Math.max(1, W / 900);
  // Keyed to the short side, so a wide frame gets more cells rather than
  // bigger ones — otherwise the backdrop reads as a different texture at 16:9.
  const step = Math.min(W, H) / 16;
  ctx.beginPath();
  for (let x = 0; x <= W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 0; y <= H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
  ctx.restore();
}

function drawBolt(ctx, cx, cy, scale, alpha, glow) {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-20, -20); // centre the 40x40 viewBox
  const g = ctx.createLinearGradient(0, 4, 0, 36);
  g.addColorStop(0, GOLD_HI);
  g.addColorStop(1, GOLD_LO);
  ctx.shadowColor = "rgba(250,204,21," + (0.55 * glow).toFixed(3) + ")";
  ctx.shadowBlur = 34 * glow;
  ctx.fillStyle = g;
  ctx.fill(BOLT);
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.stroke(BOLT);
  ctx.restore();
}

// The green rounded-square badge from the site's own mark.
function drawBadge(ctx, cx, cy, size, alpha) {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx - size / 2, cy - size / 2);
  const s = size / 40;
  ctx.scale(s, s);
  ctx.fillStyle = "#16a34a";
  ctx.beginPath();
  ctx.roundRect(0, 0, 40, 40, 10);
  ctx.fill();
  ctx.fillStyle = "rgba(253,224,71,0.14)";
  ctx.fill(BOLT);
  ctx.lineWidth = 2.6;
  const g = ctx.createLinearGradient(0, 0, 0, 40);
  g.addColorStop(0, GOLD_HI);
  g.addColorStop(1, GOLD_LO);
  ctx.strokeStyle = g;
  ctx.lineJoin = "round";
  ctx.stroke(BOLT);
  ctx.restore();
}

window.render = function (t) {
  const c = document.getElementById("c");
  const ctx = c.getContext("2d");
  const W = c.width, H = c.height;
  const cx = W / 2, cy = H / 2;
  // One scale factor, keyed to height rather than width. A 16:9 frame is wider
  // than the square it replaced, not taller: scaling by width would inflate
  // everything by 78% and push the lockup toward the edges. Keying to height
  // keeps the composition identical and spends the extra width on breathing
  // room, which is what a wide frame is for.
  const K = H / 1080;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#0b0f14";
  ctx.fillRect(0, 0, W, H);

  const sinceBlast = t - T.blast;
  // Charge ramps the glow, the blast dumps it.
  const charge = clamp((t - T.strikeEnd) / (T.chargeEnd - T.strikeEnd));
  const afterglow = sinceBlast > 0 ? Math.exp(-1.6 * sinceBlast) : 0;

  // Ambient wash: green base, gold surge while charging.
  const wash = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.62);
  const heat = clamp(charge * 0.55 + afterglow * 0.9);
  wash.addColorStop(0, "rgba(34,197,94," + (0.1 + 0.26 * heat).toFixed(3) + ")");
  wash.addColorStop(0.45, "rgba(234,179,8," + (0.05 + 0.2 * heat).toFixed(3) + ")");
  wash.addColorStop(1, "rgba(11,15,20,0)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);

  drawGrid(ctx, W, H, 0.5 + 0.4 * charge);

  // --- Bolt: strike, charge, detonate -----------------------------------
  if (sinceBlast < 0.14) {
    let scale, alpha, y = cy, glow;
    if (t < T.strikeEnd) {
      const u = clamp(t / T.strikeEnd);
      // Drops in from above and overshoots into place.
      y = cy - (1 - backOut(u)) * H * 0.55;
      scale = (10 + 16 * (1 - easeOut(u))) * K;
      alpha = clamp(u * 2.6);
      glow = 0.5 + 0.5 * u;
      // Motion streak while it is still travelling.
      if (u < 0.72) {
        ctx.save();
        ctx.globalAlpha = (0.72 - u) * 0.5;
        const tail = ctx.createLinearGradient(0, y - H * 0.4, 0, y);
        tail.addColorStop(0, "rgba(253,224,71,0)");
        tail.addColorStop(1, "rgba(253,224,71,0.5)");
        ctx.fillStyle = tail;
        ctx.fillRect(cx - 26 * K, y - H * 0.4, 52 * K, H * 0.4);
        ctx.restore();
      }
    } else {
      // Charging: breathes, then stretches taut just before it goes.
      const pulse = 1 + 0.045 * Math.sin((t - T.strikeEnd) * 7.5);
      const wind = sinceBlast > 0 ? 1 + sinceBlast * 9 : 1 - clamp(-sinceBlast / 0.22) * 0.07;
      scale = 10 * K * pulse * wind;
      alpha = sinceBlast > 0 ? clamp(1 - sinceBlast / 0.13) : 1;
      glow = 1 + charge * 1.4;
    }
    drawBolt(ctx, cx, y, scale, alpha, glow);
  }

  // --- Blast ------------------------------------------------------------
  if (sinceBlast > 0) {
    // Shockwave: fast out, thinning as it goes.
    const ringT = clamp(sinceBlast / 0.85);
    if (ringT < 1) {
      const r = easeOut(ringT) * Math.hypot(W, H) * 0.62;
      ctx.save();
      ctx.globalAlpha = (1 - ringT) * 0.75;
      ctx.strokeStyle = "rgba(253,224,71,0.9)";
      ctx.lineWidth = Math.max(1, (1 - ringT) * 22 * K);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const drag = 3.1;
    for (const p of PARTICLES) {
      const u = sinceBlast / p.life;
      if (u >= 1) continue;
      // Decelerating burst plus a little gravity, so it settles rather than
      // flying off at constant speed.
      const dist = (p.speed / drag) * (1 - Math.exp(-drag * sinceBlast)) * K;
      const x = cx + p.ox * K + Math.cos(p.a) * dist;
      const y = cy + p.oy * K + Math.sin(p.a) * dist + 180 * K * sinceBlast * sinceBlast;
      ctx.save();
      ctx.globalAlpha = (1 - u) * (1 - u);
      ctx.translate(x, y);
      ctx.rotate(p.a + p.spin * sinceBlast);
      ctx.fillStyle = p.green ? GREEN : GOLD_HI;
      const w = p.size * K * (1 - u * 0.55);
      ctx.fillRect(-w / 2, -w * 0.18, w, w * 0.36);
      ctx.restore();
    }
  }

  // --- Flash ------------------------------------------------------------
  // Starts exactly at detonation, never before it — a pre-window put a
  // full-white frame ahead of the burst, which reads as a glitch rather than
  // as a flash. Decays fast and peaks below full white: this autoplays in a
  // chat, where a hard strobe is unpleasant rather than punchy.
  if (sinceBlast >= 0 && sinceBlast < 0.5) {
    const f = Math.exp(-15 * sinceBlast);
    ctx.save();
    ctx.globalAlpha = clamp(f * 0.82);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // --- Wordmark ---------------------------------------------------------
  const fs = 132 * K;
  ctx.font = "800 " + fs + "px 'Space Grotesk', sans-serif";
  ctx.textBaseline = "alphabetic";
  const chars = "Blitz.tips".split("");
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const textW = widths.reduce((a, b) => a + b, 0);

  const badgeSize = 108 * K;
  const badgeGap = 26 * K;
  const markIn = clamp((t - T.markStart) / 0.45);
  // The lockup slides from text-centred to badge+text-centred as the badge
  // arrives, so nothing jumps when it appears.
  const lockW = textW + (badgeSize + badgeGap) * easeOut(markIn);
  let x = cx - lockW / 2;
  const baseline = cy + fs * 0.34;

  if (markIn > 0) {
    drawBadge(ctx, x + badgeSize / 2, cy, badgeSize, easeOut(markIn));
    x += (badgeSize + badgeGap) * easeOut(markIn);
  }

  const fade = t > T.fadeStart ? 1 - clamp((t - T.fadeStart) / (${DURATION} - T.fadeStart)) : 1;
  chars.forEach((ch, i) => {
    const u = clamp((t - T.revealStart - i * 0.042) / 0.38);
    if (u <= 0) { x += widths[i]; return; }
    const e = easeOut(u);
    ctx.save();
    ctx.globalAlpha = e * fade;
    // Each letter drops the last few pixels into place and scales down to 1.
    ctx.translate(x + widths[i] / 2, baseline - (1 - e) * 34 * K);
    ctx.scale(1 + (1 - e) * 0.22, 1 + (1 - e) * 0.22);
    ctx.fillStyle = i < 5 ? "#ffffff" : GREEN;
    ctx.shadowColor = i < 5 ? "rgba(255,255,255,0.35)" : "rgba(34,197,94,0.45)";
    ctx.shadowBlur = (1 - e) * 30 * K + 8 * K;
    ctx.fillText(ch, -widths[i] / 2, 0);
    ctx.restore();
    x += widths[i];
  });
};
`;

function pageHtml(w, h) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Space Grotesk';src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:300 800;font-display:block}
*{margin:0;padding:0}
html,body{width:${w}px;height:${h}px;background:#0b0f14;overflow:hidden}
canvas{display:block}
/* Forces the face to load before any canvas text is measured — canvas does not
   participate in font loading, so measureText would silently use a fallback. */
#probe{position:absolute;left:-9999px;font-family:'Space Grotesk';font-weight:800}
</style></head><body>
<div id="probe">Blitz.tips</div>
<canvas id="c" width="${w}" height="${h}"></canvas>
<script>${SCENE}
window.render(0);
</script></body></html>`;
}

async function renderVideo(chromium, { name, w, h }) {
  const frames = join(tmpdir(), `tg-ad-${w}x${h}`);
  rmSync(frames, { recursive: true, force: true });
  mkdirSync(frames, { recursive: true });

  const htmlPath = join(tmpdir(), `tg-ad-${w}x${h}.html`);
  writeFileSync(htmlPath, pageHtml(w, h));

  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? undefined });
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);

  const total = Math.round(FPS * DURATION);
  for (let i = 0; i < total; i++) {
    await page.evaluate((t) => window.render(t), i / FPS);
    await page.screenshot({ path: join(frames, `f${String(i).padStart(4, "0")}.jpg`), type: "jpeg", quality: 94 });
    if (i % 45 === 0) console.log(`  frame ${i}/${total}`);
  }
  await browser.close();

  const out = join(OUT, name);
  execFileSync(
    ffmpegPath(),
    [
      "-y",
      "-framerate", String(FPS),
      "-i", join(frames, "f%04d.jpg"),
      "-c:v", "libx264",
      "-preset", "slow",
      "-crf", "20",
      // yuv420p and even dimensions, or players that hardware-decode refuse it.
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      out,
    ],
    { stdio: ["ignore", "ignore", "inherit"] }
  );
  rmSync(frames, { recursive: true, force: true });
  console.log(out);
}

const chromium = await loadChromium();
await renderVideo(chromium, { name: "blitz-telegram-1920x1080.mp4", w: 1920, h: 1080 });
