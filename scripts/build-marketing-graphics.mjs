/**
 * Renders the Supercapper contest marketing graphics to public/marketing/.
 *
 *   npm run build            # needed once — supplies the brand webfont
 *   node scripts/build-marketing-graphics.mjs
 *
 * The bolt path and brand colours are copied from SupercapperLogo, and the
 * typeface is pulled out of the Next build output, so the exports stay in step
 * with the site instead of drifting into their own look. Re-run it whenever the
 * contest numbers change — a stale "$25,000" graphic outliving a pool change is
 * exactly the kind of thing that gets screenshotted back at you.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "fs";
import { createRequire } from "module";
import { tmpdir } from "os";
import { join } from "path";

// Playwright is a tool dependency, not a runtime one, so it isn't in
// package.json. Resolve it from the project if it's installed there, else from
// a global install (override with PLAYWRIGHT_NODE_MODULES).
async function loadChromium() {
  try {
    return (await import("playwright")).chromium;
  } catch {
    const globalModules = process.env.PLAYWRIGHT_NODE_MODULES ?? "/opt/node22/lib/node_modules/";
    try {
      return createRequire(globalModules)("playwright").chromium;
    } catch {
      throw new Error(
        "playwright not found. `npm i -D playwright`, or set PLAYWRIGHT_NODE_MODULES to a global node_modules path."
      );
    }
  }
}

const ROOT = process.cwd();
const DIR = tmpdir();
const OUT = join(ROOT, "public/marketing");
mkdirSync(OUT, { recursive: true });

// Space Grotesk, as next/font already subset and hashed it at build time. No
// network fetch, and it is byte-for-byte the face the site serves.
function brandFont() {
  const media = join(ROOT, ".next/static/media");
  let files;
  try {
    files = readdirSync(media).filter((f) => f.endsWith(".woff2"));
  } catch {
    throw new Error("No .next/static/media — run `npm run build` first.");
  }
  if (files.length === 0) throw new Error("No .woff2 in .next/static/media — run `npm run build` first.");
  // The largest subset is the latin one carrying the full alphabet.
  const biggest = files
    .map((f) => ({ f, size: statSync(join(media, f)).size }))
    .sort((a, b) => b.size - a.size)[0].f;
  return readFileSync(join(media, biggest)).toString("base64");
}

const font = brandFont();

// The bolt, lifted verbatim from SupercapperLogo so the graphics and the site
// can never drift apart.
const BOLT = `<svg viewBox="10.5 5.5 19 30.5" class="bolt" fill="none" aria-hidden="true">
  <path d="M22 6 L11 23 H18.5 L16 35 L29 19 H21.5 L24 6 Z"
        fill="#eab308" stroke="#ca8a04" stroke-width="1" stroke-linejoin="round"/>
</svg>`;

const wordmark = (size, contest = true) => `
<span class="wm" style="font-size:${size}px">
  <span class="wm-row">${BOLT}<span>uper</span><span class="green">capper</span></span>
  ${contest ? `<span class="wm-sub">Handicapping Contest</span>` : ""}
</span>`;

// "Blitz.tips" must be one flex child — as two, the gap lands between the
// word and the TLD and it reads "Blitz .tips".
const byline = `<span class="byline"><img src="${dataLogo()}" alt=""/><span>Blitz<span class="green">.tips</span></span></span>`;

function dataLogo() {
  const svg = readFileSync(join(ROOT, "public/logo-mark.svg"), "utf8");
  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}

const CSS = `
@font-face{font-family:'Space Grotesk';src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:300 700;font-display:block}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Space Grotesk',sans-serif;background:#222}
.card{position:relative;overflow:hidden;background:#0b0f14;color:#fff;display:flex;flex-direction:column;
  justify-content:center;align-items:center;text-align:center}
.card::before{content:"";position:absolute;inset:0;
  background:radial-gradient(120% 80% at 50% 0%, rgba(34,197,94,.16), transparent 60%),
             radial-gradient(90% 70% at 80% 100%, rgba(234,179,8,.13), transparent 60%)}
.card::after{content:"";position:absolute;inset:0;opacity:.5;
  background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),
                   linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);
  background-size:64px 64px;mask-image:radial-gradient(circle at 50% 45%,#000 30%,transparent 78%)}
.inner{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;width:100%}
.green{color:#22c55e}
.gold{color:#eab308}
.wm{display:inline-flex;flex-direction:column;line-height:1;font-weight:800;letter-spacing:-.02em}
.wm-row{display:inline-flex;align-items:center}
.bolt{height:1.5em;width:.94em;transform:rotate(20deg)}
.wm-sub{margin-top:.14em;align-self:center;font-size:.185em;font-weight:600;text-transform:uppercase;
  letter-spacing:.34em;opacity:.8}
.pool{font-weight:800;letter-spacing:-.03em;line-height:.95;
  background:linear-gradient(180deg,#fde68a,#eab308 55%,#ca8a04);
  -webkit-background-clip:text;background-clip:text;color:transparent}
.kicker{font-weight:700;text-transform:uppercase;letter-spacing:.3em;color:#22c55e}
.sub{color:#cbd5e1;font-weight:500}
.url{font-weight:700;color:#fff}
.byline{display:inline-flex;align-items:center;gap:.4em;font-weight:700;color:#fff;opacity:.92}
.byline img{height:1em;width:1em}
.rule{height:2px;width:120px;background:linear-gradient(90deg,transparent,#eab308,transparent)}
.steps{display:flex;gap:28px;width:100%;justify-content:center}
.step{flex:1;max-width:330px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.1);
  border-radius:18px;padding:26px 22px;text-align:left}
.step-n{font-size:15px;font-weight:800;color:#eab308;letter-spacing:.2em}
.step-t{font-size:27px;font-weight:700;margin-top:8px;line-height:1.15}
.step-b{font-size:18px;color:#94a3b8;margin-top:10px;line-height:1.45}
.pill{display:inline-flex;align-items:center;gap:10px;border:1px solid rgba(255,255,255,.18);
  border-radius:999px;padding:10px 22px;font-weight:600;color:#e2e8f0}
`;

const cards = [
  {
    name: "supercapper-hero-1600x900",
    w: 1600, h: 900,
    html: `<div class="inner" style="gap:26px">
      ${wordmark(96)}
      <div class="rule" style="margin-top:6px"></div>
      <div class="kicker" style="font-size:24px">Guaranteed prize pool</div>
      <div class="pool" style="font-size:200px">$10,000</div>
      <div class="sub" style="font-size:34px">Free to enter. Every pick graded in public.</div>
      <div style="display:flex;align-items:center;gap:22px;margin-top:14px">
        <span class="url" style="font-size:30px">blitz.tips/supercapper</span>
      </div>
    </div>`,
  },
  {
    name: "supercapper-square-1080",
    w: 1080, h: 1080,
    html: `<div class="inner" style="gap:24px;padding:70px">
      ${wordmark(82)}
      <div class="rule"></div>
      <div class="kicker" style="font-size:20px">Guaranteed</div>
      <div class="pool" style="font-size:176px">$10,000</div>
      <div class="sub" style="font-size:30px;line-height:1.35">Free to enter.<br/>Best ROI wins.</div>
      <div class="pill" style="font-size:20px;margin-top:10px">No Discord · No screenshots · Just a record</div>
      <div class="url" style="font-size:27px;margin-top:20px">blitz.tips/supercapper</div>
    </div>`,
  },
  {
    name: "supercapper-banner-1500x500",
    w: 1500, h: 500,
    html: `<div class="inner" style="gap:18px">
      ${wordmark(62)}
      <div class="sub" style="font-size:27px;margin-top:6px">
        <span class="gold" style="font-weight:800">$10,000 guaranteed</span> · Free to enter · Every pick graded in public
      </div>
      <div class="url" style="font-size:23px;opacity:.85">blitz.tips/supercapper</div>
    </div>`,
  },
  {
    name: "supercapper-howitworks-1600x900",
    w: 1600, h: 900,
    html: `<div class="inner" style="gap:40px;padding:64px">
      ${wordmark(60)}
      <div class="sub" style="font-size:29px;margin-top:-6px">
        <span class="gold" style="font-weight:800">$10,000 guaranteed.</span> Free to enter.
      </div>
      <div class="steps">
        <div class="step">
          <div class="step-n">01</div>
          <div class="step-t">Post your picks</div>
          <div class="step-b">Timestamped against live odds. You can't delete a loser or move a line after the fact.</div>
        </div>
        <div class="step">
          <div class="step-n">02</div>
          <div class="step-t">Get graded</div>
          <div class="step-b">Every pick settles automatically when the game does. The record is public.</div>
        </div>
        <div class="step">
          <div class="step-n">03</div>
          <div class="step-t">Best ROI wins</div>
          <div class="step-b">Volume-adjusted, so grinding beats a lucky parlay. 100 graded picks to qualify.</div>
        </div>
      </div>
      <div class="url" style="font-size:27px">blitz.tips/supercapper</div>
    </div>`,
  },
  {
    name: "supercapper-vertical-1080x1350",
    w: 1080, h: 1350,
    html: `<div class="inner" style="gap:26px;padding:80px 60px">
      ${wordmark(78)}
      <div class="rule"></div>
      <div class="kicker" style="font-size:21px">Guaranteed prize pool</div>
      <div class="pool" style="font-size:184px">$10,000</div>
      <div class="sub" style="font-size:31px;line-height:1.4">
        Free to enter.<br/>Every pick graded in public.<br/>Best ROI wins.
      </div>
      <div class="pill" style="font-size:21px;margin-top:8px">100 graded picks to qualify</div>
      <div class="url" style="font-size:29px;margin-top:26px">blitz.tips/supercapper</div>
      <div style="margin-top:30px;font-size:23px" >${byline}</div>
    </div>`,
  },
];

const page_html = `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
${cards.map((c) => `<div class="card" id="${c.name}" style="width:${c.w}px;height:${c.h}px">${c.html}</div>`).join("\n")}
</body></html>`;

const htmlPath = join(DIR, "blitz-marketing-graphics.html");
writeFileSync(htmlPath, page_html);

const chromium = await loadChromium();
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? undefined });
const page = await browser.newPage({ viewport: { width: 1700, height: 1400 }, deviceScaleFactor: 2 });
await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600);

for (const c of cards) {
  await page.locator(`#${c.name}`).screenshot({ path: `${OUT}/${c.name}.png` });
  console.log(`public/marketing/${c.name}.png  ${c.w}x${c.h} @2x`);
}
await browser.close();
