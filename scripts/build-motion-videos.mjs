/**
 * Renders the animation-led Supercapper video ads to public/marketing/.
 *
 *   npm run build                        # supplies the brand webfont
 *   node scripts/build-motion-videos.mjs
 *
 * Where build-x-videos.mjs is type that fades in and out, these are built to
 * stop a thumb: an odometer that rolls, a slip that gets stamped, a leaderboard
 * that reorders itself, a wall of prices that flickers. Three shapes so there's
 * one for each place X puts a video.
 *
 * Everything is a pure function of the clock — including the confetti, whose
 * particles come from a seeded PRNG rather than Math.random — so frame N is
 * identical on every run and a re-render never silently changes the cut.
 *
 * Silent by design, like the rest of the set: X autoplays muted.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync } from "fs";
import { createRequire } from "module";
import { execFileSync } from "child_process";
import { tmpdir } from "os";
import { join } from "path";

const ROOT = process.cwd();
const OUT = join(ROOT, "public/marketing");
const FPS = 30;

// The contest's own numbers — claims, so re-run this if they change in admin.
const POOL = 10000;
const STARTS = "Aug 10 2026";
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

const BOLT = `<svg viewBox="10.5 5.5 19 30.5" class="bolt" fill="none">
  <path d="M22 6 L11 23 H18.5 L16 35 L29 19 H21.5 L24 6 Z" fill="#eab308" stroke="#ca8a04"
        stroke-width="1" stroke-linejoin="round"/>
</svg>`;

const wordmark = (size, id = "") => `
  <span class="wm" style="font-size:${size}" ${id ? `id="${id}"` : ""}>
    <span class="wm-row">${BOLT}<span>uper</span><span class="green">capper</span></span>
    <span class="wm-sub">Handicapping Contest</span>
  </span>`;

// One flex child, not two — a gap between "Blitz" and ".tips" renders as
// "Blitz .tips".
const byline = `<span class="byline"><img src="${logoMark}" alt=""/><span>Blitz<span class="green">.tips</span></span></span>`;

/** An odometer digit column: 0-9 stacked, scrolled to show one. */
const digitColumn = (id, w, h) => `
  <span class="digit" style="width:${w}px;height:${h}px">
    <span class="digit-strip" id="${id}">${[0,1,2,3,4,5,6,7,8,9]
      .map((n) => `<span style="height:${h}px;line-height:${h}px">${n}</span>`)
      .join("")}</span>
  </span>`;

const baseCss = (w, h) => `
@font-face{font-family:'Space Grotesk';src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:300 700;font-display:block}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${w}px;height:${h}px;overflow:hidden;background:#0b0f14}
body{font-family:'Space Grotesk',sans-serif;color:#fff}
#stage{position:relative;width:${w}px;height:${h}px;overflow:hidden}
.bg{position:absolute;inset:0;
  background:radial-gradient(110% 70% at 50% 0%, rgba(34,197,94,.20), transparent 60%),
             radial-gradient(90% 60% at 85% 100%, rgba(234,179,8,.18), transparent 60%)}
.grid{position:absolute;inset:-25%;opacity:.5;
  background-image:linear-gradient(rgba(255,255,255,.05) 2px,transparent 2px),
                   linear-gradient(90deg,rgba(255,255,255,.05) 2px,transparent 2px);
  background-size:120px 120px;
  mask-image:radial-gradient(circle at 50% 45%,#000 25%,transparent 80%)}
/* A light that sweeps the frame on each beat — the cheapest way to make a
   static composition feel alive. */
.sweep{position:absolute;top:-30%;bottom:-30%;width:38%;pointer-events:none;
  background:linear-gradient(100deg,transparent,rgba(255,255,255,.10),transparent);
  transform:skewX(-14deg)}
.scene{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
  justify-content:center;text-align:center;will-change:opacity,transform}
.green{color:#22c55e}.gold{color:#eab308}.red{color:#ef4444}
.wm{display:inline-flex;flex-direction:column;line-height:1;font-weight:800;letter-spacing:-.02em}
.wm-row{display:inline-flex;align-items:center}
.bolt{height:1.5em;width:.94em;transform:rotate(20deg)}
.wm-sub{margin-top:.14em;align-self:center;font-size:.185em;font-weight:600;text-transform:uppercase;
  letter-spacing:.34em;opacity:.85}
.kicker{font-weight:700;text-transform:uppercase;color:#22c55e}
.sub{color:#cbd5e1;font-weight:500;line-height:1.4}
.url{font-weight:800}
.byline{display:inline-flex;align-items:center;gap:.35em;font-weight:700;opacity:.9}
.byline img{height:1.1em;width:1.1em}
.pill{display:inline-flex;align-items:center;border:2px solid rgba(255,255,255,.22);
  border-radius:999px;font-weight:600;color:#e2e8f0}

/* Odometer */
.odo{display:inline-flex;align-items:center;font-weight:800;letter-spacing:-.03em;
  background:linear-gradient(180deg,#fde68a,#eab308 55%,#ca8a04);
  -webkit-background-clip:text;background-clip:text;color:transparent}
.digit{display:inline-block;overflow:hidden;position:relative;text-align:center}
.digit-strip{display:block;will-change:transform}

/* Bet slip */
.slip{position:relative;border-radius:28px;background:rgba(255,255,255,.05);
  border:2px solid rgba(255,255,255,.12);backdrop-filter:blur(2px);
  box-shadow:0 40px 120px rgba(0,0,0,.45);will-change:transform}
.slip-row{display:flex;align-items:center;justify-content:space-between}
.stamp{position:absolute;display:flex;align-items:center;justify-content:center;
  border:8px solid #22c55e;color:#22c55e;border-radius:22px;font-weight:800;
  letter-spacing:.12em;transform-origin:center;will-change:transform,opacity}
.confetti{position:absolute;inset:0;overflow:visible;pointer-events:none}
.confetti i{position:absolute;display:block;border-radius:3px;will-change:transform,opacity}

/* Leaderboard */
.board{position:relative;width:100%}
/* Rows are absolutely positioned, so they ignore this element's padding —
   the inset has to come from its width, not from padding. */
.row{position:absolute;left:0;right:0;display:flex;align-items:center;gap:26px;
  border-radius:20px;padding:0 30px;background:rgba(255,255,255,.045);
  border:2px solid rgba(255,255,255,.07);will-change:transform}
.row.me{background:rgba(34,197,94,.16);border-color:rgba(34,197,94,.55)}
.row.win{background:rgba(234,179,8,.18);border-color:rgba(234,179,8,.65)}
.rank{width:1.6em;text-align:center;font-weight:800;color:#94a3b8}
.row.me .rank{color:#22c55e}.row.win .rank{color:#eab308}
.handle{flex:1;text-align:left;font-weight:700}
.roi{font-weight:800;font-variant-numeric:tabular-nums}

/* Odds wall */
.wall{position:absolute;inset:0;display:grid;gap:14px;padding:40px;align-content:center}
.cell{display:flex;align-items:center;justify-content:space-between;border-radius:14px;
  padding:0 20px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);
  font-weight:700;will-change:opacity,transform}
.cell .lbl{color:#94a3b8;font-weight:600}
`;

// Shared motion helpers. Everything derives from t; nothing reads a clock or a
// random number at frame time.
const MOTION_JS = `
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ease=(p)=>1-Math.pow(1-clamp(p,0,1),3);
const easeInOut=(p)=>{p=clamp(p,0,1);return p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;};
// Overshoots then settles — what makes a stamp land rather than appear.
const back=(p)=>{p=clamp(p,0,1);const c1=2.2,c3=c1+1;return 1+c3*Math.pow(p-1,3)+c1*Math.pow(p-1,2);};
const seg=(t,from,dur)=>ease((t-from)/dur);
const segIO=(t,from,dur)=>easeInOut((t-from)/dur);
function show(el,t,inAt,outAt,rise){
  const fi=seg(t,inAt,0.4), fo=outAt==null?0:seg(t,outAt,0.3);
  const o=clamp(fi-fo,0,1);
  el.style.opacity=o;
  const y=(1-fi)*(rise==null?44:rise)-fo*36;
  el.style.transform='translateY('+y+'px)';
  return o;
}
function drift(t,px){
  const g=document.getElementById('grid');
  if(g) g.style.transform='translate('+(-t*px)+'px,'+(-t*px*0.6)+'px)';
}
// A light bar crossing the frame, once per beat.
function sweep(t,el,startAt,dur,w){
  const p=(t-startAt)/dur;
  el.style.opacity = p>=0&&p<=1 ? 1 : 0;
  el.style.left = (-40 + easeInOut(p)*(w*0.01*140)) + '%';
}
// Odometer: each column scrolls to its digit, later columns lagging slightly so
// the number rolls in rather than snapping as a block.
function odometer(t,ids,value,h,from,dur){
  const p=seg(t,from,dur);
  const shown=Math.round(value*p);
  const s=String(shown).padStart(ids.length,'0');
  ids.forEach((id,i)=>{
    const el=document.getElementById(id);
    if(!el) return;
    const lag=clamp((p-i*0.04)/(1-ids.length*0.04),0,1);
    const d=Number(s[i]);
    el.style.transform='translateY('+(-d*h)+'px)';
    el.style.opacity=0.25+0.75*lag;
  });
}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
`;

/**
 * 1. The graded slip. A pick card lands, the price ticks, then WIN stamps down
 *    hard with a confetti burst. This is the product's whole promise in one
 *    gesture: you post it, it gets graded, in public.
 */
const slip = {
  name: "supercapper-motion-slip-1920x1080.mp4",
  w: 1920,
  h: 1080,
  duration: 12,
  html: `
  <div class="sweep" id="sweep" style="opacity:0"></div>

  <div class="scene" id="s1">
    <div class="kicker" style="font-size:28px;letter-spacing:.32em">Every pick, posted before kickoff</div>
    <div class="slip" id="slipCard" style="width:900px;padding:46px 52px 150px;margin-top:44px">
      <div class="slip-row" style="font-size:26px;color:#94a3b8">
        <span>SUPERCAPPER · ENTRY #0412</span><span id="slipClock">19:45 · TODAY</span>
      </div>
      <div class="slip-row" style="margin-top:34px;font-size:52px;font-weight:800">
        <span>Arsenal −0.5</span><span class="gold" id="slipOdds">−110</span>
      </div>
      <div class="slip-row" style="margin-top:22px;font-size:30px;color:#94a3b8">
        <span>Premier League · 2 units<span id="slipState"></span></span>
      </div>
      <div class="confetti" id="confetti"></div>
      <div class="stamp" id="stamp" style="left:52px;bottom:30px;width:250px;height:96px;font-size:50px;opacity:0">WIN</div>
    </div>
  </div>

  <div class="scene" id="s2">
    <div class="kicker" style="font-size:28px;letter-spacing:.32em">Guaranteed prize pool</div>
    <div class="odo" id="odo" style="font-size:250px;margin-top:14px">
      <span>$</span>${digitColumn("d0", 130, 250)}${digitColumn("d1", 130, 250)}<span>,</span>${digitColumn("d2", 130, 250)}${digitColumn("d3", 130, 250)}${digitColumn("d4", 130, 250)}
    </div>
    <div class="sub" style="font-size:40px;margin-top:16px">Free to enter · best ROI wins</div>
  </div>

  <div class="scene" id="s3">
    ${wordmark("100px")}
    <div class="pill" style="font-size:32px;padding:16px 40px;margin-top:46px">${STARTS} → ${ENDS}</div>
    <div class="url" style="font-size:56px;margin-top:34px">${URL}</div>
    <div style="margin-top:30px;font-size:32px">${byline}</div>
  </div>`,
  render: `
  drift(t,14);
  sweep(t,document.getElementById('sweep'),3.4,0.9,1920);

  const o1=show(document.getElementById('s1'),t,0.15,4.6);
  show(document.getElementById('s2'),t,4.9,8.0);
  show(document.getElementById('s3'),t,8.3,null);

  // The slip drops in with a slight tilt that straightens as it lands.
  const land=back(clamp((t-0.3)/0.8,0,1));
  const card=document.getElementById('slipCard');
  card.style.transform='translateY('+((1-land)*90)+'px) rotate('+((1-land)*-3.5)+'deg) scale('+(0.94+0.06*land)+')';

  // The price ticks while it's pending — a board that's alive, not a picture.
  if(t<3.2){
    const ticks=['−110','−108','−112','−110','−105'];
    document.getElementById('slipOdds').textContent=ticks[Math.floor(t*3)%ticks.length];
  } else {
    document.getElementById('slipOdds').textContent='−110';
  }

  // Stamp: scales down from oversized, overshoots, then the card kicks.
  const st=document.getElementById('stamp');
  const sp=clamp((t-3.3)/0.45,0,1);
  if(t>=3.3){
    const s=2.4-1.4*back(sp);
    st.style.opacity=Math.min(1,sp*2.2);
    st.style.transform='rotate(-13deg) scale('+s+')';
    document.getElementById('slipState').innerHTML=' · <span class="green">GRADED +1.82u</span>';
  } else {
    st.style.opacity=0;
    st.style.transform='rotate(-13deg) scale(2.4)';
  }
  // Impact shake on the card, decaying fast.
  if(t>=3.72&&t<4.05){
    const k=(4.05-t)/0.33;
    card.style.transform+=' translateX('+(Math.sin((t-3.72)*90)*10*k)+'px)';
  }

  // Confetti: 46 particles from a fixed seed, so the burst is the same every
  // render. Position is plain ballistics from the stamp point.
  const conf=document.getElementById('confetti');
  if(!conf.dataset.built){
    const rnd=mulberry32(20260803);
    const colors=['#22c55e','#eab308','#fde68a','#ffffff'];
    let html='';
    for(let i=0;i<46;i++){
      const vx=(rnd()-0.72)*820, vy=-380-rnd()*520, w=8+rnd()*16, h=8+rnd()*20;
      html+='<i data-vx="'+vx+'" data-vy="'+vy+'" data-vr="'+((rnd()-0.5)*900)+'" style="width:'+w+'px;height:'+h+'px;background:'+colors[i%4]+'"></i>';
    }
    conf.innerHTML=html;
    conf.dataset.built='1';
  }
  const dt=t-3.68;
  [...conf.children].forEach((p)=>{
    if(dt<0||dt>2.2){p.style.opacity=0;return;}
    const vx=+p.dataset.vx, vy=+p.dataset.vy, vr=+p.dataset.vr;
    const x=176+vx*dt, y=296+vy*dt+0.5*900*dt*dt;
    p.style.transform='translate('+x+'px,'+y+'px) rotate('+(vr*dt)+'deg)';
    p.style.opacity=clamp(1-dt/2.0,0,1)*o1;
  });

  odometer(t,['d0','d1','d2','d3','d4'],${POOL},250,5.0,1.6);`,
};

/**
 * 2. The climb. A live board reorders itself and @you walks up it to first,
 *    ROI counting as it goes. The most product-true of the three: this is
 *    literally what the standings page does, just faster.
 *
 *    The handles and numbers are illustrative — generic placeholders, not real
 *    entrants. Once the board has a real field, a screen recording of the real
 *    thing beats this.
 */
const ROWS = [
  { handle: "@linehawk", roi: 14.2 },
  { handle: "@bluepuck", roi: 12.8 },
  { handle: "@you", roi: 4.1, me: true },
  { handle: "@railbird", roi: 11.4 },
  { handle: "@fadethechalk", roi: 9.6 },
  { handle: "@coldstreak", roi: 8.2 },
];
const climb = {
  name: "supercapper-motion-climb-1080x1920.mp4",
  w: 1080,
  h: 1920,
  duration: 12,
  html: `
  <div class="sweep" id="sweep" style="opacity:0"></div>

  <div class="scene" id="s1" style="justify-content:center">
    <div class="kicker" style="font-size:28px;letter-spacing:.3em">Live standings</div>
    <div class="board" id="board" style="height:640px;margin-top:54px;width:940px">
      ${ROWS.map(
        (r, i) => `<div class="row${r.me ? " me" : ""}" id="row${i}" style="height:96px;font-size:38px">
          <span class="rank" id="rank${i}">${i + 1}</span>
          <span class="handle">${r.handle}</span>
          <span class="roi" id="roi${i}">${r.roi.toFixed(1)}%</span>
        </div>`
      ).join("")}
    </div>
    <div class="sub" id="climbCaption" style="font-size:36px;margin-top:40px">Ranked by ROI. Every pick graded.</div>
  </div>

  <div class="scene" id="s2">
    <div class="kicker" style="font-size:26px;letter-spacing:.3em">Guaranteed prize pool</div>
    <div class="odo" id="odo" style="font-size:200px;margin-top:14px">
      <span>$</span>${digitColumn("d0", 104, 200)}${digitColumn("d1", 104, 200)}<span>,</span>${digitColumn("d2", 104, 200)}${digitColumn("d3", 104, 200)}${digitColumn("d4", 104, 200)}
    </div>
    <div class="sub" style="font-size:40px;margin-top:18px">Free to enter</div>
  </div>

  <div class="scene" id="s3">
    ${wordmark("108px")}
    <div class="pill" style="font-size:30px;padding:14px 34px;margin-top:44px">${STARTS} → ${ENDS}</div>
    <div class="url" style="font-size:52px;margin-top:36px">${URL}</div>
    <div style="margin-top:32px;font-size:30px">${byline}</div>
  </div>`,
  render: `
  drift(t,9);
  sweep(t,document.getElementById('sweep'),5.2,0.9,1080);

  show(document.getElementById('s1'),t,0.15,6.0);
  show(document.getElementById('s2'),t,6.3,9.0);
  show(document.getElementById('s3'),t,9.3,null);

  // Three reorderings: @you climbs 3rd-from-bottom -> 3rd -> 2nd -> 1st, and
  // everyone it passes slides down a slot. Positions interpolate, so nothing
  // teleports.
  const ORDERS=[[0,1,2,3,4,5],[0,1,2,3,4,5],[0,2,1,3,4,5],[2,0,1,3,4,5]];
  const AT=[0,1.6,3.0,4.3];
  const H=112;
  const startRoi=[14.2,12.8,4.1,11.4,9.6,8.2];
  const endRoi=[14.9,13.1,18.6,11.4,9.6,8.2];
  for(let i=0;i<6;i++){
    // Where this row sits in each ordering.
    const slotAt=(o)=>ORDERS[o].indexOf(i);
    let pos=slotAt(0);
    for(let k=1;k<ORDERS.length;k++){
      const p=segIO(t,AT[k],0.55);
      pos=pos+(slotAt(k)-slotAt(k-1))*p;
    }
    const row=document.getElementById('row'+i);
    row.style.transform='translateY('+(pos*H)+'px)';
    document.getElementById('rank'+i).textContent=String(Math.round(pos)+1);
    // @you's ROI climbs with it; everyone else holds.
    const g=seg(t,1.4,3.2);
    const v=startRoi[i]+(endRoi[i]-startRoi[i])*g;
    document.getElementById('roi'+i).textContent=v.toFixed(1)+'%';
    document.getElementById('roi'+i).style.color = i===2 ? '#22c55e' : '#e2e8f0';
    // Gold once it's actually first.
    if(i===2){
      const first=t>4.85;
      row.className='row '+(first?'win':'me');
    }
  }
  const cap=document.getElementById('climbCaption');
  cap.textContent = t>5.0 ? 'Best ROI wins the pool.' : 'Ranked by ROI. Every pick graded.';

  odometer(t,['d0','d1','d2','d3','d4'],${POOL},200,6.4,1.6);`,
};

/**
 * 3. The wall. Prices flicker across a full-frame board and then collapse into
 *    the wordmark. Sells breadth — every market, every league — in a way a
 *    list of league names can't.
 */
const CELLS = [
  ["ARS / CHE", "−110"], ["LAL / BOS", "+135"], ["NYY / BOS", "−145"],
  ["MCI / LIV", "+108"], ["KC / BUF", "−118"], ["EDM / COL", "+122"],
  ["REA / BAR", "+164"], ["GSW / DEN", "−102"], ["INT / MIL", "−128"],
  ["DAL / PHI", "+112"], ["BAY / DOR", "−135"], ["MIA / NYK", "+141"],
  ["PSG / MAR", "−152"], ["TB / TOR", "+119"], ["JUV / NAP", "−106"],
  ["SEA / SF", "+127"], ["AJA / PSV", "−114"], ["BOS / TOR", "+133"],
];
const wall = {
  name: "supercapper-motion-wall-1080x1080.mp4",
  w: 1080,
  h: 1080,
  duration: 10,
  html: `
  <div class="sweep" id="sweep" style="opacity:0"></div>

  <div class="wall" id="wall" style="grid-template-columns:repeat(3,1fr);grid-auto-rows:88px">
    ${CELLS.map(
      (c, i) =>
        `<div class="cell" id="cell${i}" style="font-size:28px"><span class="lbl">${c[0]}</span><span id="price${i}">${c[1]}</span></div>`
    ).join("")}
  </div>

  <div class="scene" id="s1" style="justify-content:flex-end;padding-bottom:70px">
    <div class="kicker" id="wallCaption" style="font-size:26px;letter-spacing:.3em">Every market · every league</div>
  </div>

  <div class="scene" id="s2">
    ${wordmark("104px")}
    <div class="sub" style="font-size:38px;margin-top:40px">
      <span class="gold" style="font-weight:800">$${POOL.toLocaleString("en-US")}</span> guaranteed · free to enter
    </div>
    <div class="pill" style="font-size:28px;padding:14px 32px;margin-top:34px">${STARTS} → ${ENDS}</div>
    <div class="url" style="font-size:48px;margin-top:32px">${URL}</div>
    <div style="margin-top:28px;font-size:28px">${byline}</div>
  </div>`,
  render: `
  drift(t,8);
  sweep(t,document.getElementById('sweep'),4.6,0.8,1080);

  // Cells arrive in a diagonal wave, flicker their price like a live board,
  // then fall away in the same wave so the wordmark can take the frame.
  const n=${CELLS.length};
  const ALT=['−110','−108','+114','−121','+102','−134','+147','−117'];
  for(let i=0;i<n;i++){
    const col=i%3, rowIdx=Math.floor(i/3);
    const delay=(col+rowIdx)*0.07;
    const inP=seg(t,0.15+delay,0.45);
    const outP=seg(t,4.3+delay*0.5,0.4);
    const el=document.getElementById('cell'+i);
    el.style.opacity=clamp(inP-outP,0,1);
    el.style.transform='translateY('+((1-inP)*34-outP*26)+'px) scale('+(0.94+0.06*inP)+')';
    // Each cell reprices on its own offbeat, so the wall never pulses in unison.
    const price=document.getElementById('price'+i);
    if(t>0.9&&t<4.3){
      const k=Math.floor((t*2.2+i*2.6)%ALT.length);
      const moved=(i*7+k)%3===0;
      price.textContent = moved ? ALT[k] : '${""}'||price.textContent;
      if(moved) price.className = k%2 ? 'green' : 'gold';
    }
  }

  show(document.getElementById('s1'),t,0.5,4.2,20);
  show(document.getElementById('s2'),t,4.9,null);`,
};

function pageHtml(spec) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${baseCss(spec.w, spec.h)}</style></head>
<body><div id="stage"><div class="bg"></div><div class="grid" id="grid"></div>${spec.html}</div>
<script>${MOTION_JS}
window.render=function(t){${spec.render}};
window.render(0);
</script></body></html>`;
}

async function renderVideo(chromium, spec) {
  const frames = join(tmpdir(), `motion-${spec.w}x${spec.h}`);
  rmSync(frames, { recursive: true, force: true });
  mkdirSync(frames, { recursive: true });

  const htmlPath = join(tmpdir(), `motion-${spec.w}x${spec.h}.html`);
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
    if (i % 90 === 0) console.log(`  ${spec.name} frame ${i}/${total}`);
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
const specs = [slip, climb, wall].filter((s) => only.length === 0 || only.some((o) => s.name.includes(o)));
const chromium = await loadChromium();
for (const spec of specs) await renderVideo(chromium, spec);
