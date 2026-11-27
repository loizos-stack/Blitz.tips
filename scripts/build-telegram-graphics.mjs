/**
 * Renders the Blitz.tips Telegram ad images to public/marketing/.
 *
 *   npm run build            # needed once — supplies the brand webfont
 *   node scripts/build-telegram-graphics.mjs
 *
 * Site branding, not the contest's — deliberately. These sit beside
 * blitz-telegram-1920x1080.mp4, which is also plain Blitz.tips, and the
 * Supercapper graphics next to them are all for a contest that is currently
 * hidden from the public site. An ad pointing at /supercapper would land on a
 * 404.
 *
 * Nothing here states a figure the site can't back. The monthly prize is the
 * live one from Admin → Prizes ($500 split 250/150/100); there is deliberately
 * no subscriber count, no "join 10,000 bettors", no win rate. On a site whose
 * entire pitch is verified records, an unverifiable number in the advert is the
 * one thing that can't be walked back.
 *
 * Same approach as build-marketing-graphics.mjs: the typeface is pulled out of
 * the Next build output and the mark is read from public/logo-mark.svg, so
 * these stay in step with the site instead of drifting into their own look.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, renameSync } from "fs";
import { execFileSync } from "child_process";
import { createRequire } from "module";
import { tmpdir } from "os";
import { join } from "path";

async function loadChromium() {
  try {
    return (await import("playwright")).chromium;
  } catch {
    const globalModules = process.env.PLAYWRIGHT_NODE_MODULES ?? "/opt/node22/lib/node_modules/";
    try {
      return createRequire(globalModules)("playwright").chromium;
    } catch {
      try {
        return createRequire(globalModules)("playwright-core").chromium;
      } catch {
        throw new Error(
          "playwright not found. `npm i -D playwright`, or set PLAYWRIGHT_NODE_MODULES to a global node_modules path."
        );
      }
    }
  }
}

const ROOT = process.cwd();
const DIR = tmpdir();
const OUT = join(ROOT, "public/marketing");
mkdirSync(OUT, { recursive: true });

/**
 * Space Grotesk — the site's own face, embedded so the render needs no network.
 *
 * Prefers what next/font already subset into the build output, because that is
 * byte-for-byte what visitors are served. Falls back to the copy committed
 * beside these images, which is the same Google Fonts latin subset at the same
 * 300–700 variable range; next/font fetches exactly this file. The fallback
 * exists so the graphics can be re-rendered in a fresh checkout without a full
 * `npm install && next build` first — which is a fifteen-minute detour to
 * obtain a 22 KB file that does not change.
 */
function brandFont() {
  const media = join(ROOT, ".next/static/media");
  let files = [];
  try {
    files = readdirSync(media).filter((f) => f.endsWith(".woff2"));
  } catch {
    /* not built — fall through to the committed copy */
  }
  if (files.length > 0) {
    const biggest = files
      .map((f) => ({ f, size: statSync(join(media, f)).size }))
      .sort((a, b) => b.size - a.size)[0].f;
    return readFileSync(join(media, biggest)).toString("base64");
  }
  const vendored = join(ROOT, "public/marketing/fonts/space-grotesk-latin.woff2");
  try {
    return readFileSync(vendored).toString("base64");
  } catch {
    throw new Error(
      `No webfont: build the app (for .next/static/media) or restore ${vendored}.`
    );
  }
}

const font = brandFont();

function dataLogo() {
  const svg = readFileSync(join(ROOT, "public/logo-mark.svg"), "utf8");
  return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
}
const LOGO = dataLogo();

/** The site lockup. One flex child, or the gap lands inside "Blitz .tips". */
const lockup = (size) => `
<span class="lockup" style="font-size:${size}px">
  <img src="${LOGO}" alt=""/><span>Blitz<span class="green">.tips</span></span>
</span>`;

const CSS = `
@font-face{font-family:'Space Grotesk';src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:300 700;font-display:block}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Space Grotesk',sans-serif;background:#222}
.card{position:relative;overflow:hidden;background:#0b0f14;color:#fff;display:flex;
  flex-direction:column;justify-content:center;align-items:center;text-align:center}
.card::before{content:"";position:absolute;inset:0;
  background:radial-gradient(120% 80% at 50% 0%, rgba(34,197,94,.18), transparent 60%),
             radial-gradient(90% 70% at 85% 100%, rgba(234,179,8,.12), transparent 60%)}
.card::after{content:"";position:absolute;inset:0;opacity:.5;
  background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),
                   linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px);
  background-size:64px 64px;mask-image:radial-gradient(circle at 50% 45%,#000 30%,transparent 78%)}
.inner{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;width:100%}
.green{color:#22c55e}
.gold{color:#eab308}
.lockup{display:inline-flex;align-items:center;gap:.34em;font-weight:800;letter-spacing:-.02em;line-height:1}
.lockup img{height:1.05em;width:1.05em}
.kicker{font-weight:700;text-transform:uppercase;letter-spacing:.3em;color:#22c55e}
.head{font-weight:800;letter-spacing:-.035em;line-height:1.04}
.sub{color:#cbd5e1;font-weight:500;line-height:1.45}
.pool{font-weight:800;letter-spacing:-.04em;line-height:.95;
  background:linear-gradient(180deg,#fde68a,#eab308 55%,#ca8a04);
  -webkit-background-clip:text;background-clip:text;color:transparent}

/* The verified-pick slip. The whole product claim in one object: a price, a
   stake, a timestamp before kick-off, and a result nobody could go back and
   soften. Deliberately carries no handle — an invented record pinned on a real
   handicapper would be exactly the dishonesty the site sells against. */
.slip{width:100%;max-width:var(--slipw,760px);background:rgba(255,255,255,.055);
  border:1px solid rgba(255,255,255,.12);border-radius:20px;overflow:hidden;text-align:left}
.slip-row{display:flex;align-items:center;justify-content:space-between;gap:16px;
  padding:var(--slippad,20px 26px)}
.slip-row + .slip-row{border-top:1px solid rgba(255,255,255,.09)}
.slip-k{font-size:var(--slipk,15px);font-weight:700;text-transform:uppercase;
  letter-spacing:.2em;color:#64748b}
.slip-v{font-size:var(--slipv,24px);font-weight:700}
.tag{display:inline-flex;align-items:center;gap:.5em;border-radius:999px;
  padding:.34em .9em;font-size:var(--tag,17px);font-weight:700}
.tag-lock{background:rgba(148,163,184,.16);color:#cbd5e1}
.tag-win{background:rgba(34,197,94,.16);color:#4ade80}
/* The lockup alone, no separate URL beside it. The brand IS the domain, and
   "Blitz.tips | blitz.tips" reads as a mistake rather than as emphasis. */
.foot{display:flex;align-items:center;justify-content:center}
.prizerow{display:flex;gap:var(--pg,18px);justify-content:center;width:100%}
.prize{flex:1;max-width:var(--pw,240px);background:rgba(255,255,255,.05);
  border:1px solid rgba(255,255,255,.11);border-radius:16px;padding:var(--pp,18px 10px)}
.prize-p{font-size:var(--pps,14px);font-weight:800;letter-spacing:.2em;color:#64748b}
.prize-v{font-size:var(--pvs,34px);font-weight:800;margin-top:4px}
/* The qualifying condition. Quiet, but present. */
.fine{color:#94a3b8;font-weight:500}
`;

/**
 * The one live figure in here: the monthly leaderboard prize.
 *
 * Mirrors PRIZE_CENTS and MIN_SETTLED_PICKS in src/lib/monthly-prizes.ts, which
 * is the source of truth — change them there and these follow by hand, because
 * this script runs standalone and cannot import a "server-only" module. The
 * qualifying minimum is on the card deliberately: an advert for a cash prize
 * that hides its entry condition is the kind of thing this site exists to be
 * the opposite of.
 */
const PRIZE_TOTAL = "$500";
const PRIZES = [["1ST", "$250"], ["2ND", "$150"], ["3RD", "$100"]];
const MIN_PICKS = 10;

/** The receipt. Illustrative, unattributed — the mechanism, not a claim. */
const slip = () => `
<div class="slip">
  <div class="slip-row">
    <div><div class="slip-k">The pick</div><div class="slip-v">Lakers −3.5 &nbsp;<span style="color:#94a3b8">−110</span> &nbsp;· 2u</div></div>
    <span class="tag tag-lock">🔒 Locked</span>
  </div>
  <div class="slip-row">
    <div><div class="slip-k">Posted</div><div class="slip-v">19:04 — before tip-off</div></div>
    <span class="tag tag-win">Graded +1.82u</span>
  </div>
</div>`;

const prizeRow = () => `
<div class="prizerow">
  ${PRIZES.map(([p, v]) => `<div class="prize"><div class="prize-p">${p}</div><div class="prize-v">${v}</div></div>`).join("")}
</div>`;

const cards = [
  {
    // The default. 16:9 is what Telegram renders full-width in a channel post
    // and in a link preview, so it is the one to reach for unless you know you
    // want the extra mobile height.
    name: "blitz-telegram-ad-1280x720",
    w: 1280, h: 720, exact: true,
    html: `<div class="inner" style="gap:30px;padding:0 70px;--slipw:720px">
      <div class="kicker" style="font-size:18px">Verified sports handicappers</div>
      <div class="head" style="font-size:74px">
        Timestamped before tip-off.<br/><span class="green">Impossible to edit after.</span>
      </div>
      <div class="sub" style="font-size:25px;max-width:820px">
        Posted before the game starts, graded against the final score, and the handicapper
        can't go back and change it. Compare real records before you follow anyone.
      </div>
      ${slip()}
      <div class="foot" style="margin-top:10px">${lockup(44)}</div>
    </div>`,
  },
  {
    // Square takes more vertical space than 16:9 in a phone feed, and it is
    // also the shape Telegram's own ad slots crop closest to.
    name: "blitz-telegram-ad-1080x1080",
    w: 1080, h: 1080, exact: true,
    html: `<div class="inner" style="gap:34px;padding:0 70px;--slipw:830px;--slipv:28px;--slipk:16px;--tag:19px">
      <div class="kicker" style="font-size:20px">Verified sports handicappers</div>
      <div class="head" style="font-size:84px">
        Timestamped<br/>before tip-off.<br/><span class="green">Locked after.</span>
      </div>
      <div class="sub" style="font-size:28px;max-width:820px">
        Graded against the final score, and never editable after. Compare real records
        before you follow anyone.
      </div>
      ${slip()}
      <div class="foot" style="margin-top:16px">${lockup(52)}</div>
    </div>`,
  },
  {
    // For recruiting handicappers rather than bettors — the other half of a
    // marketplace, and the half with a concrete number attached.
    name: "blitz-telegram-cappers-1280x720",
    w: 1280, h: 720, exact: true,
    html: `<div class="inner" style="gap:24px;padding:0 70px;--pw:250px">
      <div class="kicker" style="font-size:18px">Monthly leaderboard</div>
      <div class="pool" style="font-size:138px">${PRIZE_TOTAL}</div>
      <div class="head" style="font-size:40px;margin-top:-10px">
        every month, to the best verified records
      </div>
      ${prizeRow()}
      <div class="fine" style="font-size:18px;margin-top:-8px">
        Ranked on net units. ${MIN_PICKS} settled picks in the month to qualify.
      </div>
      <div class="sub" style="font-size:24px;max-width:860px">
        Post your picks, keep 80–90% of your subscriptions, and let an unedited record do the selling.
        Free to join.
      </div>
      <div class="foot" style="margin-top:8px">${lockup(44)}</div>
    </div>`,
  },
];

const page_html = `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
${cards.map((c) => `<div class="card" id="${c.name}" style="width:${c.w}px;height:${c.h}px">${c.html}</div>`).join("\n")}
</body></html>`;

const htmlPath = join(DIR, "blitz-telegram-graphics.html");
writeFileSync(htmlPath, page_html);

const chromium = await loadChromium();
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? undefined,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 1200 }, deviceScaleFactor: 2 });
await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600);

for (const c of cards) {
  const path = `${OUT}/${c.name}.png`;
  await page.locator(`#${c.name}`).screenshot({ path });
  if (c.exact) {
    // Rendered at 2x and downscaled, so the type is supersampled rather than
    // rasterised at final size. Lanczos: the default softens small type at a
    // 2:1 reduction. Via a temp file — ffmpeg won't read and write one path.
    const staged = join(tmpdir(), `${c.name}-2x.png`);
    renameSync(path, staged);
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error", "-i", staged,
      "-vf", `scale=${c.w}:${c.h}:flags=lanczos`, "-frames:v", "1", "-update", "1", path,
    ]);
  }
  console.log(`public/marketing/${c.name}.png  ${c.w}x${c.h}`);
}
await browser.close();
