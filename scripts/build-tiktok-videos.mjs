/**
 * Renders the TikTok-native Supercapper cuts to public/marketing/.
 *
 *   npm run build                          # supplies the brand webfont
 *   node scripts/build-tiktok-videos.mjs   # all four
 *   node scripts/build-tiktok-videos.mjs receipt   # just one
 *
 * Four 12–15s cuts at 1080×1920. These are not the X vertical cut reformatted —
 * TikTok covers different parts of the frame and rewards a different opening,
 * so the composition rules differ:
 *
 *  - **Safe box.** TikTok's action rail (avatar, like, comment, share, spinning
 *    disc) occupies roughly the right 180px from y≈900 down, and the caption,
 *    username and audio ticker eat the bottom ~380px. The top ~180px carries
 *    the For You / Following tabs and the search icon. Everything here stays
 *    inside x 60–1020, y 200–1120 — see SAFE, which explains why the bottom
 *    inset is far larger than the caption block alone would need. That box is
 *    much shorter than the one supercapper-x-9x16 uses, which is why this isn't
 *    a re-encode.
 *  - **Hook on frame one.** Every cut has legible copy at t=0. No fade up from
 *    black, no logo sting first — on a For You page the first frame is the
 *    thumbnail and the swipe decision is made inside a second. The X cuts can
 *    afford a beat; these can't.
 *  - **Bigger type.** Minimum body size here is 40px against ~30px on the X
 *    cuts, because TikTok overlays its own UI text over the frame and anything
 *    small competes with it.
 *
 * Silent by design, like every other cut in this repo — but for a different
 * reason. X autoplays muted so sound would be wasted; TikTok is sound-on, and
 * the convention is that you add a trending track in the app at post time. A
 * baked-in track is a licensing problem and the first thing a creator mutes.
 * Every claim is on screen, so the cut still reads with the sound off.
 *
 * Everything is a pure function of the clock, so frame N is identical on every
 * run and a re-render never silently changes the cut.
 *
 * Numbers here are claims — see docs/supercapper-twitter-kit.md. Note the rule
 * that no cut quotes a fixed first prize: the ladder is computed from the field
 * size, so "$10,000 guaranteed" is true and "$3,100 for first" is not.
 *
 * (The shared font/bolt/motion helpers are duplicated from
 * build-motion-videos.mjs rather than imported. The four video scripts each
 * stand alone by convention; pulling them into a shared kit would mean
 * re-rendering assets that are already published and correct.)
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync } from "fs";
import { createRequire } from "module";
import { execFileSync } from "child_process";
import { tmpdir } from "os";
import { join } from "path";

const ROOT = process.cwd();
const OUT = join(ROOT, "public/marketing");
const FPS = 30;
const W = 1080;
const H = 1920;

// TikTok's chrome-free box. Left/right are symmetric even though only the right
// rail is occupied — off-centre copy reads as a mistake, not as a safe area.
//
// The bottom inset is 800 rather than the ~380 the caption block actually
// needs, because the action rail is the binding constraint, not the caption.
// The rail covers x>900 from y≈900 down, so anything *wide* — the bet slip, the
// payout ladder, a step row — has to finish above y=900 or its right edge sits
// under the like button. Pulling the whole box up to 200–1120 centres every
// scene in the region where full width is actually usable, instead of centring
// at y≈850 and clipping the one element each cut is built around.
const SAFE = { left: 60, right: 60, top: 200, bottom: 800 };

// The contest's own numbers — claims, so re-run this if they change in admin.
const POOL = 10000;
const STARTS = "Aug 10 2026";
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
    return execFileSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"])
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

const BOLT = `<svg viewBox="10.5 5.5 19 30.5" class="bolt" fill="none">
  <path d="M22 6 L11 23 H18.5 L16 35 L29 19 H21.5 L24 6 Z" fill="#eab308" stroke="#ca8a04"
        stroke-width="1" stroke-linejoin="round"/>
</svg>`;

const wordmark = (size) => `
  <span class="wm" style="font-size:${size}">
    <span class="wm-row">${BOLT}<span>uper</span><span class="green">capper</span></span>
    <span class="wm-sub">Handicapping Contest</span>
  </span>`;

const byline = `<span class="byline"><img src="${logoMark}" alt=""/><span>Blitz<span class="green">.tips</span></span></span>`;

const digitColumn = (id, w, h) => `
  <span class="digit" style="width:${w}px;height:${h}px">
    <span class="digit-strip" id="${id}">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
      .map((n) => `<span style="display:block;height:${h}px;line-height:${h}px">${n}</span>`)
      .join("")}</span>
  </span>`;

const baseCss = `
@font-face{font-family:'Space Grotesk';src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:300 700;font-display:block}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#0b0f14}
body{font-family:'Space Grotesk',sans-serif;color:#fff}
#stage{position:relative;width:${W}px;height:${H}px;overflow:hidden}
.bg{position:absolute;inset:0;
  background:radial-gradient(120% 55% at 50% 12%, rgba(34,197,94,.22), transparent 62%),
             radial-gradient(95% 45% at 80% 92%, rgba(234,179,8,.20), transparent 62%)}
.grid{position:absolute;inset:-25%;opacity:.5;
  background-image:linear-gradient(rgba(255,255,255,.05) 2px,transparent 2px),
                   linear-gradient(90deg,rgba(255,255,255,.05) 2px,transparent 2px);
  background-size:120px 120px;
  mask-image:radial-gradient(circle at 50% 40%,#000 25%,transparent 78%)}
.sweep{position:absolute;top:-30%;bottom:-30%;width:38%;pointer-events:none;
  background:linear-gradient(100deg,transparent,rgba(255,255,255,.10),transparent);
  transform:skewX(-14deg)}

/* Every scene is clamped to the safe box rather than to the frame. */
.scene{position:absolute;left:${SAFE.left}px;right:${SAFE.right}px;top:${SAFE.top}px;
  bottom:${SAFE.bottom}px;display:flex;flex-direction:column;align-items:center;
  justify-content:center;text-align:center;will-change:opacity,transform}

.green{color:#22c55e}.gold{color:#eab308}.red{color:#ef4444}
.wm{display:inline-flex;flex-direction:column;line-height:1;font-weight:800;letter-spacing:-.02em}
.wm-row{display:inline-flex;align-items:center}
.bolt{height:1.5em;width:.94em;transform:rotate(20deg)}
.wm-sub{margin-top:.14em;align-self:center;font-size:.185em;font-weight:600;text-transform:uppercase;
  letter-spacing:.34em;opacity:.85}
.kicker{font-weight:700;text-transform:uppercase;color:#22c55e;letter-spacing:.28em}
.sub{color:#cbd5e1;font-weight:500;line-height:1.35}
.url{font-weight:800}
.byline{display:inline-flex;align-items:center;gap:.35em;font-weight:700;opacity:.9}
.byline img{height:1.1em;width:1.1em}
.pill{display:inline-flex;align-items:center;border:2px solid rgba(255,255,255,.22);
  border-radius:999px;font-weight:600;color:#e2e8f0}
/* The big statement type. Tight leading, because these run 2-3 lines inside a
   box that is only ~1300px tall. */
.line{font-weight:800;letter-spacing:-.02em;line-height:1.06}

.odo{display:inline-flex;align-items:center;font-weight:800;letter-spacing:-.03em;
  background:linear-gradient(180deg,#fde68a,#eab308 55%,#ca8a04);
  -webkit-background-clip:text;background-clip:text;color:transparent}
.digit{display:inline-block;overflow:hidden;position:relative;text-align:center}
.digit-strip{display:block;will-change:transform}
/* Half of the odometer fix; the other half is display:block in digitColumn.
   Both are required — verified by rendering each combination.
   1. The digit spans must be blocks or "height" is ignored on them (inline,
      non-replaced), all ten sit on one horizontal line, and translating the
      strip moves the row out of the clip window instead of scrolling it.
   2. The gradient must be re-declared here rather than inherited from .odo.
      .odo clips its gradient to its own text, which reaches the "$" and ","
      as direct text children but not digits inside an overflow:hidden,
      composited .digit-strip.
   With only one of the two applied the number renders as "$ ," — the
   punctuation paints and every digit is missing. */
.digit-strip span{background:linear-gradient(180deg,#fde68a,#eab308 55%,#ca8a04);
  -webkit-background-clip:text;background-clip:text;color:transparent}

.slip{position:relative;border-radius:30px;background:rgba(255,255,255,.055);
  border:2px solid rgba(255,255,255,.13);box-shadow:0 40px 120px rgba(0,0,0,.45);
  will-change:transform;width:100%}
.slip-row{display:flex;align-items:center;justify-content:space-between}
.stamp{position:absolute;display:flex;align-items:center;justify-content:center;
  border:9px solid #22c55e;color:#22c55e;border-radius:24px;font-weight:800;
  letter-spacing:.12em;transform-origin:center;will-change:transform,opacity}
.confetti{position:absolute;inset:0;overflow:visible;pointer-events:none}
.confetti i{position:absolute;display:block;border-radius:3px;will-change:transform,opacity}

/* Payout ladder */
.places{display:flex;gap:18px;justify-content:center;width:100%}
.place{flex:1;border-radius:22px;background:rgba(255,255,255,.05);
  border:2px solid rgba(255,255,255,.09);padding:26px 0;will-change:opacity,transform}
.place.on{background:rgba(234,179,8,.16);border-color:rgba(234,179,8,.6)}
.place .n{font-weight:800;font-size:52px}
.place .l{font-size:24px;color:#94a3b8;font-weight:600;margin-top:6px}

/* Numbered steps */
.step{display:flex;align-items:center;gap:28px;width:100%;text-align:left;
  border-radius:24px;padding:24px 34px;background:rgba(255,255,255,.05);
  border:2px solid rgba(255,255,255,.08);will-change:opacity,transform}
.step .num{flex:none;width:74px;height:74px;border-radius:50%;display:flex;
  align-items:center;justify-content:center;font-weight:800;font-size:38px;
  background:rgba(34,197,94,.18);color:#22c55e;border:2px solid rgba(34,197,94,.5)}
.step .txt{font-weight:700;font-size:44px;line-height:1.15}
.step .txt small{display:block;font-weight:500;font-size:29px;color:#94a3b8;margin-top:8px}
`;

const MOTION_JS = `
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ease=(p)=>1-Math.pow(1-clamp(p,0,1),3);
const easeInOut=(p)=>{p=clamp(p,0,1);return p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;};
const back=(p)=>{p=clamp(p,0,1);const c1=2.2,c3=c1+1;return 1+c3*Math.pow(p-1,3)+c1*Math.pow(p-1,2);};
const seg=(t,from,dur)=>ease((t-from)/dur);
const segIO=(t,from,dur)=>easeInOut((t-from)/dur);
function show(el,t,inAt,outAt,rise){
  const fi=seg(t,inAt,0.36), fo=outAt==null?0:seg(t,outAt,0.28);
  const o=clamp(fi-fo,0,1);
  el.style.opacity=o;
  const y=(1-fi)*(rise==null?40:rise)-fo*32;
  el.style.transform='translateY('+y+'px)';
  return o;
}
/* Frame-one variant: fully on at t=0, so the thumbnail is the hook rather than
   an empty stage. Only ever used for a cut's opening element. */
function showFromZero(el,t,outAt){
  const fo=outAt==null?0:seg(t,outAt,0.28);
  el.style.opacity=clamp(1-fo,0,1);
  el.style.transform='translateY('+(-fo*32)+'px)';
}
function drift(t,px){
  const g=document.getElementById('grid');
  if(g) g.style.transform='translate('+(-t*px)+'px,'+(-t*px*0.6)+'px)';
}
function sweep(t,el,startAt,dur){
  const p=(t-startAt)/dur;
  el.style.opacity = p>=0&&p<=1 ? 1 : 0;
  el.style.left = (-40 + easeInOut(p)*140) + '%';
}
function odometer(t,ids,value,h,from,dur){
  const p=seg(t,from,dur);
  const shown=Math.round(value*p);
  const s=String(shown).padStart(ids.length,'0');
  ids.forEach((id,i)=>{
    const el=document.getElementById(id);
    if(!el) return;
    const lag=clamp((p-i*0.04)/(1-ids.length*0.04),0,1);
    el.style.transform='translateY('+(-Number(s[i])*h)+'px)';
    el.style.opacity=0.25+0.75*lag;
  });
}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
`;

/**
 * 1. The receipt. Pure statement type, one claim at a time, opening on the
 *    line that picks a fight. The cheapest cut to make and usually the one
 *    that travels — no mechanic to understand, just an argument.
 */
const receipt = {
  name: "supercapper-tiktok-receipt-1080x1920.mp4",
  duration: 13,
  html: `
  <div class="sweep" id="sweep" style="opacity:0"></div>

  <div class="scene" id="s1">
    <div class="line" style="font-size:104px">Everyone says<br/>they're <span class="green">up</span>.</div>
  </div>

  <div class="scene" id="s2" style="opacity:0">
    <div class="line" style="font-size:86px">Almost nobody<br/>posts a record<br/>you can <span class="gold">check</span>.</div>
  </div>

  <div class="scene" id="s3" style="opacity:0">
    <div class="kicker" style="font-size:30px">Guaranteed pool</div>
    <div class="odo" id="odo" style="font-size:184px;margin-top:20px">
      <span>$</span>${digitColumn("d0", 96, 184)}${digitColumn("d1", 96, 184)}<span>,</span>${digitColumn("d2", 96, 184)}${digitColumn("d3", 96, 184)}${digitColumn("d4", 96, 184)}
    </div>
    <div class="line" style="font-size:60px;margin-top:26px">says you can.</div>
  </div>

  <div class="scene" id="s4" style="opacity:0">
    ${wordmark("96px")}
    <div class="pill" style="font-size:30px;padding:14px 32px;margin-top:40px">Free to enter · Starts ${STARTS}</div>
    <div class="url" style="font-size:50px;margin-top:34px">${URL}</div>
    <div style="margin-top:30px;font-size:30px">${byline}</div>
  </div>`,
  render: `
  drift(t,8);
  sweep(t,document.getElementById('sweep'),6.4,0.85);

  showFromZero(document.getElementById('s1'),t,3.0);
  show(document.getElementById('s2'),t,3.3,6.3);
  show(document.getElementById('s3'),t,6.6,9.7);
  show(document.getElementById('s4'),t,10.0,null);

  odometer(t,['d0','d1','d2','d3','d4'],${POOL},184,6.7,1.5);`,
};

/**
 * 2. The graded slip. The product's whole promise in one gesture: a pick lands,
 *    the price ticks, WIN stamps down. The 16:9 motion cut does this too, but
 *    at 1920×1080 — this is the portrait build, laid out for the safe box
 *    rather than letterboxed into it.
 */
const slip = {
  name: "supercapper-tiktok-slip-1080x1920.mp4",
  duration: 14,
  html: `
  <div class="sweep" id="sweep" style="opacity:0"></div>

  <div class="scene" id="s1">
    <div class="line" id="slipHead" style="font-size:76px">Post it.<br/>It grades <span class="green">itself</span>.</div>

    <div style="position:relative;width:100%;margin-top:38px">
      <div class="slip" id="slip" style="padding:32px 40px">
        <div class="slip-row" style="font-size:30px;color:#94a3b8;font-weight:600">
          <span>NBA · Tonight</span><span id="clock">19:42</span>
        </div>
        <div class="slip-row" style="margin-top:20px;font-size:52px;font-weight:800">
          <span>Lakers −4.5</span><span class="gold" id="price">−110</span>
        </div>
        <div class="slip-row" style="margin-top:18px;font-size:30px;color:#cbd5e1;font-weight:600;justify-content:flex-start;gap:16px">
          <span>@you</span><span>·</span><span id="stakeLbl">1.0u</span>
        </div>
        <div class="stamp" id="stamp" style="right:26px;bottom:-18px;width:230px;height:94px;font-size:48px;opacity:0">WIN</div>
        <div class="confetti" id="confetti"></div>
      </div>
    </div>

    <div class="sub" id="slipCap" style="font-size:36px;margin-top:38px">Locked to the price you took.</div>
  </div>

  <div class="scene" id="s2" style="opacity:0">
    <div class="line" style="font-size:82px">No edits.<br/>No deletes.<br/>No <span class="red">"that was a lean"</span>.</div>
    <div class="sub" style="font-size:38px;margin-top:40px">The record is the product.</div>
  </div>

  <div class="scene" id="s3" style="opacity:0">
    ${wordmark("96px")}
    <div class="pill" style="font-size:30px;padding:14px 32px;margin-top:40px">$${POOL.toLocaleString("en-US")} guaranteed · free</div>
    <div class="url" style="font-size:50px;margin-top:34px">${URL}</div>
    <div style="margin-top:30px;font-size:30px">${byline}</div>
  </div>`,
  render: `
  drift(t,7);
  sweep(t,document.getElementById('sweep'),8.1,0.85);

  showFromZero(document.getElementById('s1'),t,7.6);
  show(document.getElementById('s2'),t,7.9,10.7);
  show(document.getElementById('s3'),t,11.0,null);

  // The slip settles in, then takes the stamp's kick.
  const land=seg(t,0.25,0.7);
  const kick=Math.sin(clamp((t-4.05)/0.34,0,1)*Math.PI)*13;
  document.getElementById('slip').style.transform=
    'translateY('+((1-land)*44+kick)+'px) scale('+(0.955+0.045*land)+')';

  // Price drifts −110 → −118 before lock, so the "locked to the price you took"
  // line has something to be about.
  const mv=seg(t,1.5,1.6);
  document.getElementById('price').textContent='−'+Math.round(110+8*mv);
  document.getElementById('clock').textContent = t>3.6 ? 'FINAL' : '19:42';
  document.getElementById('stakeLbl').textContent = t>3.6 ? '+0.91u' : '1.0u';
  document.getElementById('stakeLbl').style.color = t>3.6 ? '#22c55e' : '#cbd5e1';

  // Stamp overshoots then settles.
  const st=document.getElementById('stamp');
  const sp=clamp((t-3.75)/0.5,0,1);
  st.style.opacity = sp>0?1:0;
  st.style.transform='rotate(-11deg) scale('+(sp<1?1.9-0.9*back(sp):1)+')';

  document.getElementById('slipCap').textContent =
    t>4.2 ? 'Graded the second the game ends.' : 'Locked to the price you took.';

  // Seeded burst — same particles every render.
  const cf=document.getElementById('confetti');
  if(!cf.dataset.built){
    const rnd=mulberry32(20260810);
    let html='';
    for(let i=0;i<46;i++){
      const c=['#22c55e','#eab308','#ffffff','#38bdf8'][Math.floor(rnd()*4)];
      html+='<i data-a="'+(rnd()*2-1)+'" data-b="'+rnd()+'" style="left:'+(46+rnd()*50)+'%;top:'+(76+rnd()*20)+'%;width:'+(9+rnd()*11)+'px;height:'+(9+rnd()*11)+'px;background:'+c+'"></i>';
    }
    cf.innerHTML=html; cf.dataset.built='1';
  }
  const bp=clamp((t-3.95)/1.5,0,1);
  [...cf.children].forEach((p,i)=>{
    const a=Number(p.dataset.a), b=Number(p.dataset.b);
    p.style.opacity = bp>0&&bp<1 ? 1-bp*bp : 0;
    p.style.transform='translate('+(a*260*bp)+'px,'+(-215*bp+430*bp*bp)+'px) rotate('+(a*640*bp)+'deg)';
  });`,
};

/**
 * 3. The ladder. Answers the one objection that kills a free contest — "$10,000
 *    guaranteed, what's the catch" — by showing the payout widening as the
 *    field grows. Deliberately never names a first prize: the ladder is
 *    computed from entrant count, so any fixed figure would be wrong.
 */
const ladder = {
  name: "supercapper-tiktok-ladder-1080x1920.mp4",
  duration: 13,
  html: `
  <div class="sweep" id="sweep" style="opacity:0"></div>

  <div class="scene" id="s1">
    <div class="line" style="font-size:86px">Free contest.<br/><span class="gold">$${POOL.toLocaleString("en-US")}</span> guaranteed.</div>
    <div class="sub" style="font-size:44px;margin-top:34px">So what's the catch?</div>
  </div>

  <div class="scene" id="s2" style="opacity:0">
    <div class="kicker" style="font-size:28px">Entrants</div>
    <div class="odo" id="fieldOdo" style="font-size:160px;margin-top:14px">
      ${digitColumn("e0", 84, 160)}${digitColumn("e1", 84, 160)}
    </div>
    <div class="places" style="margin-top:52px">
      <div class="place on" id="p1"><div class="n">1st</div><div class="l">paid</div></div>
      <div class="place on" id="p2"><div class="n">2nd</div><div class="l">paid</div></div>
      <div class="place on" id="p3"><div class="n">3rd</div><div class="l">paid</div></div>
      <div class="place" id="p4"><div class="n">4th</div><div class="l">at 30</div></div>
      <div class="place" id="p5"><div class="n">5th</div><div class="l">at 40</div></div>
    </div>
    <div class="sub" id="ladderCap" style="font-size:34px;margin-top:30px">3 paid places to start.</div>
  </div>

  <div class="scene" id="s3" style="opacity:0">
    <div class="line" style="font-size:74px">There isn't one.</div>
    <div class="sub" style="font-size:40px;margin-top:36px">
      The whole pool is paid out<br/>however many turn up.<br/>
      <span style="color:#eab308;font-weight:700">A small field just means<br/>a bigger slice.</span>
    </div>
  </div>

  <div class="scene" id="s4" style="opacity:0">
    ${wordmark("96px")}
    <div class="pill" style="font-size:30px;padding:14px 32px;margin-top:40px">Starts ${STARTS} · free to enter</div>
    <div class="url" style="font-size:50px;margin-top:34px">${URL}</div>
    <div style="margin-top:30px;font-size:30px">${byline}</div>
  </div>`,
  render: `
  drift(t,8);
  sweep(t,document.getElementById('sweep'),6.6,0.85);

  showFromZero(document.getElementById('s1'),t,2.7);
  show(document.getElementById('s2'),t,3.0,7.3);
  show(document.getElementById('s3'),t,7.6,10.3);
  show(document.getElementById('s4'),t,10.6,null);

  // Field climbs 8 -> 42; the 4th place lights at 30, the 5th at 40.
  const grow=seg(t,3.3,3.1);
  const field=Math.round(8+34*grow);
  const fs=String(field).padStart(2,'0');
  [['e0',0],['e1',1]].forEach(([id,i])=>{
    document.getElementById(id).style.transform='translateY('+(-Number(fs[i])*160)+'px)';
  });
  document.getElementById('p4').className='place'+(field>=30?' on':'');
  document.getElementById('p5').className='place'+(field>=40?' on':'');
  const spots = field>=40?5:field>=30?4:3;
  document.getElementById('ladderCap').textContent=
    spots===3 ? '3 paid places to start.' : spots+' paid places — one more per 10 entrants.';`,
};

/**
 * 4. Three steps. The explainer, and the one to post when the others have run:
 *    no argument, no objection-handling, just what you actually do. Ends on the
 *    hardest number in the contest (100 graded picks) because burying it wins
 *    entrants who quit in October.
 */
const steps = {
  name: "supercapper-tiktok-steps-1080x1920.mp4",
  duration: 12,
  html: `
  <div class="sweep" id="sweep" style="opacity:0"></div>

  <div class="scene" id="s1" style="justify-content:flex-start;padding-top:0px">
    <div class="line" style="font-size:76px">How to win<br/><span class="gold">$${POOL.toLocaleString("en-US")}</span></div>

    <div class="step" id="st1" style="margin-top:40px;opacity:0">
      <span class="num">1</span>
      <span class="txt">Join<small>Free. No card, no sub.</small></span>
    </div>
    <div class="step" id="st2" style="margin-top:18px;opacity:0">
      <span class="num">2</span>
      <span class="txt">Post your picks<small>Straight off the live board.</small></span>
    </div>
    <div class="step" id="st3" style="margin-top:18px;opacity:0">
      <span class="num">3</span>
      <span class="txt">They grade themselves<small>Timestamped. Public. Permanent.</small></span>
    </div>
  </div>

  <div class="scene" id="s2" style="opacity:0">
    <div class="line" style="font-size:80px">Best <span class="green">ROI</span><br/>takes the pool.</div>
    <div class="sub" style="font-size:38px;margin-top:38px">
      100 graded picks to qualify.<br/>
      <span style="color:#94a3b8">Five months, not five parlays.</span>
    </div>
  </div>

  <div class="scene" id="s3" style="opacity:0">
    ${wordmark("96px")}
    <div class="pill" style="font-size:30px;padding:14px 32px;margin-top:40px">Starts ${STARTS}</div>
    <div class="url" style="font-size:50px;margin-top:34px">${URL}</div>
    <div style="margin-top:30px;font-size:30px">${byline}</div>
  </div>`,
  render: `
  drift(t,7);
  sweep(t,document.getElementById('sweep'),6.0,0.85);

  showFromZero(document.getElementById('s1'),t,6.5);
  show(document.getElementById('s2'),t,6.8,9.5);
  show(document.getElementById('s3'),t,9.8,null);

  // Steps land one at a time, each with a small overshoot so it arrives.
  [['st1',1.0],['st2',2.5],['st3',4.0]].forEach(([id,at])=>{
    const el=document.getElementById(id);
    const p=clamp((t-at)/0.5,0,1);
    el.style.opacity=p;
    el.style.transform='translateY('+((1-back(p))*46)+'px)';
  });`,
};

function pageHtml(spec) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${baseCss}</style></head>
<body><div id="stage"><div class="bg"></div><div class="grid" id="grid"></div>${spec.html}</div>
<script>${MOTION_JS}
window.render=function(t){${spec.render}};
window.render(0);
</script></body></html>`;
}

async function renderVideo(chromium, spec) {
  const frames = join(tmpdir(), `tiktok-${spec.name}`);
  rmSync(frames, { recursive: true, force: true });
  mkdirSync(frames, { recursive: true });

  const htmlPath = join(tmpdir(), `tiktok-${spec.name}.html`);
  writeFileSync(htmlPath, pageHtml(spec));

  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? undefined });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);

  const total = FPS * spec.duration;
  for (let i = 0; i < total; i++) {
    await page.evaluate((t) => window.render(t), i / FPS);
    await page.screenshot({ path: join(frames, `f${String(i).padStart(4, "0")}.jpg`), type: "jpeg", quality: 92 });
    if (i % 120 === 0) console.log(`  ${spec.name} frame ${i}/${total}`);
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
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      out,
    ],
    { stdio: ["ignore", "ignore", "inherit"] }
  );
  rmSync(frames, { recursive: true, force: true });
  console.log(out);
}

const only = process.argv.slice(2);
const specs = [receipt, slip, ladder, steps].filter(
  (s) => only.length === 0 || only.some((o) => s.name.includes(o))
);
const chromium = await loadChromium();
for (const spec of specs) await renderVideo(chromium, spec);
