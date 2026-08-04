# Contest marketing graphics

Rendered by `scripts/build-marketing-graphics.mjs`. Don't hand-edit the PNGs —
change the script and re-run, so the exports stay in step with the site's own
logo and colours.

```bash
npm run build                                    # supplies the brand webfont
PLAYWRIGHT_CHROMIUM=/path/to/chromium \
  node scripts/build-marketing-graphics.mjs      # env var optional
```

All exports are 2× for retina.

| File | Size | Use |
|---|---|---|
| `supercapper-hero-1600x900.png` | 1600×900 | Pinned post, link preview, in-feed on X |
| `supercapper-howitworks-1600x900.png` | 1600×900 | Thread post 2, or a standalone explainer |
| `supercapper-square-1080.png` | 1080×1080 | Instagram feed, X in-feed square |
| `supercapper-vertical-1080x1350.png` | 1080×1350 | Instagram portrait (most feed space) |
| `supercapper-banner-1500x500.png` | 1500×500 | X profile header |
| `supercapper-starts-1600x900.png` | 1600×900 | "Starts Aug 10" — the pre-launch push |
| `supercapper-dates-1600x900.png` | 1600×900 | Key dates, both ends, with the enter-anytime caveat |
| `supercapper-starts-square-1080.png` | 1080×1080 | "Starts Aug 10", square |
| `supercapper-countdown-1080x1350.png` | 1080×1350 | Season run, portrait |
| `supercapper-x-money-dates-1600x900.png` | 1600×900 | Money + dates, the default X post |
| `supercapper-x-payout-1600x900.png` | 1600×900 | How the pool pays — answers "will I actually get paid" |
| `supercapper-x-money-dates-1080x1350.png` | 1080×1350 | Money + dates, portrait (more mobile feed space) |
| `supercapper-x-bold-1600x900.png` | 1600×900 | Type-only, no wordmark lockup — stands out in a scroll |

## Video

| File | Size | Length | Use |
|---|---|---|---|
| `supercapper-promo-1080x1920.mp4` | 1080×1920 | 13s | TikTok, Reels, Shorts, Stories |
| `supercapper-x-16x9-1920x1080.mp4` | 1920×1080 | 12s | X in-feed — full width on desktop, never letterboxed |
| `supercapper-x-square-1080.mp4` | 1080×1080 | 9s | X in-feed, mobile-first — square takes more timeline height than 16:9 |
| `supercapper-x-9x16-1080x1920.mp4` | 1080×1920 | 10s | X vertical — fills a phone screen; also fine for Stories |
| `supercapper-motion-slip-1920x1080.mp4` | 1920×1080 | 12s | The graded slip — a pick lands, ticks, gets stamped WIN |
| `supercapper-motion-climb-1080x1920.mp4` | 1080×1920 | 12s | The climb — a live board reorders and @you walks to first |
| `supercapper-motion-wall-1080x1080.mp4` | 1080×1080 | 10s | The odds wall — prices flicker, then collapse into the mark |
| `supercapper-tiktok-receipt-1080x1920.mp4` | 1080×1920 | 13s | TikTok — the argument, statement type only |
| `supercapper-tiktok-slip-1080x1920.mp4` | 1080×1920 | 14s | TikTok — a pick lands, ticks, gets stamped WIN |
| `supercapper-tiktok-ladder-1080x1920.mp4` | 1080×1920 | 13s | TikTok — "what's the catch", answered with the payout ladder |
| `supercapper-tiktok-steps-1080x1920.mp4` | 1080×1920 | 12s | TikTok — the three-step explainer |

## The TikTok set

Built by `scripts/build-tiktok-videos.mjs`. Pass a name fragment to render one
(`node scripts/build-tiktok-videos.mjs ladder`).

**These are not the X vertical cut re-encoded**, even though both are 1080×1920.
TikTok covers different parts of the frame and rewards a different opening:

- **Safe box.** TikTok's action rail sits in the right ~180px from y≈900 down,
  and the caption block eats the bottom ~380px. Everything stays inside
  x 60–1020, y 200–1120. The script's `SAFE` constant explains why the bottom
  inset is far bigger than the caption alone needs — the rail is the binding
  constraint for anything *wide*, like the bet slip or the payout ladder.
- **Hook on frame one.** Every cut is legible at t=0, no fade from black and no
  logo sting. On a For You page the first frame is the thumbnail.
- **Bigger type**, because TikTok overlays its own UI text on the frame.

Silent, like the rest of the set, but for a different reason: TikTok is
sound-on and expects you to add a trending track in the app. A baked-in track
is a licensing problem and the first thing a creator mutes. Every claim is on
screen, so the cuts still read muted.

The four are deliberately different arguments, not four edits of one: `receipt`
picks the fight, `slip` shows the mechanic, `ladder` handles the "free contest,
$10,000, what's the catch" objection, and `steps` is the plain explainer. Post
them in that order — the explainer converts best once someone has a reason to
care.

`ladder` never names a first prize, on purpose. The payout is computed from the
field size, so any fixed figure is wrong; see the claims table in
`docs/supercapper-twitter-kit.md`.

The three `motion-*` cuts are the animation-led set, built by
`scripts/build-motion-videos.mjs`. Pass a name fragment to render just one
(`node scripts/build-motion-videos.mjs slip`) — a full pass is three browsers
and ~1,000 frames.

They animate rather than fade: a digit-column odometer for the pool, a stamp
that overshoots and kicks the card, a seeded confetti burst (fixed seed, so the
same particles every render), rows that interpolate between orderings, and a
price wall that arrives and leaves on a diagonal wave.

**The handles and ROI figures in the climb are illustrative.** They're invented
placeholders, deliberately not the seeded demo accounts, so nothing reads as a
claim about a named account's real record. Once the board has a real field, a
screen recording of the actual standings beats this — see "Not included" below.

**Two 9:16 files, on purpose.** `supercapper-promo` is the TikTok/Reels cut,
where you land on one video at a time and 13 seconds is a normal ask.
`supercapper-x-9x16` is three seconds shorter and leads with the prize instead
of the logo, because X is a scroll. The X one also keeps every element inside
the middle band: X doesn't always show a vertical video at full height in the
timeline, so anything near the top or bottom edge can be cropped before someone
taps.

```bash
npm run build
node scripts/build-promo-video.mjs      # the 9:16 cut
node scripts/build-x-videos.mjs         # both X cuts
# both need ffmpeg; they fall back to imageio-ffmpeg
```

All three are H.264 / yuv420p with `+faststart`, and all are **silent by
design** — see the note below.

The two X cuts are deliberately short. The timeline is a scroll: a loop that
comes back around beats one that runs long enough to be swiped past. They're
also entirely text-driven, because X autoplays muted and a video that needs
sound to make sense makes no sense to most of the people who see it.

Frames are driven by an explicit clock rather than CSS animations, so frame N is
identical on every run regardless of machine speed.

**No audio, deliberately.** TikTok and Reels expect you to add trending sound in
the app — a baked-in track is a licensing problem and the first thing a creator
would mute. Post it and pick audio on the platform. On X the reason is
different but the answer is the same: it autoplays muted, so every claim is on
screen and nothing depends on sound.

9:16 covers TikTok, Reels, Shorts and Stories. Keep the important content away
from the top and bottom ~15%, where the platform UI sits — the current cut keeps
everything in the middle band for that reason.

## Dates

`STARTS` / `ENDS` at the top of the script are the seeded contest window —
**August 10, 2026 → January 10, 2027** — taken from the `Contest` row's `startsAt`
and `endsAt`.

Verify against the live row before publishing. An admin can change these in the
contests panel without a migration, so the values here are the best available
source, not proof of what production currently holds. The pool has been edited
once ($25,000 → $10,000) and the start once (Aug 3 → Aug 10), which is exactly
how these drift.

`registrationClosesAt` is **September 27, 2026**, set by the dynamic-payouts
migration. (This section previously said it was null and that entries stayed
open until `endsAt` — that stopped being true when the column was populated.)
The dates card's "enter any time" copy is therefore about the start, not the
close: you can join after the contest begins, but not after registration
shuts.

## Notes

- **Banner safe area.** X overlays the avatar bottom-left and crops the top and
  bottom on mobile. The banner keeps everything centred and away from the
  corners for that reason — if you re-cut it, don't push copy to the edges.
- **X sizing.** A single 16:9 image renders full-width in the timeline uncropped,
  which is why the `x-*` set defaults to 1600×900. The 4:5 portrait takes more
  vertical space on mobile but gets cropped in some multi-image layouts — post it
  on its own.
- **The payout card is the objection-handler.** "Free contest, $10,000
  guaranteed" reads as too good to be true; that card exists to answer it with
  the actual mechanic rather than a promise.
- **The numbers are claims.** `$10,000` and `100 graded picks` come from the live
  contest config. If either changes, re-run this script *and* replace anything
  already scheduled. A stale `$25,000` graphic outliving the pool change is
  exactly what gets screenshotted back at you.
- **The typeface** is Space Grotesk, read out of `.next/static/media` — the same
  file the site serves, so there's no rendering drift and no network fetch.
- **The bolt** is copied from `SupercapperLogo`. If the logo changes, update both.

## Not included

The highest-converting asset is a **real standings screenshot** — actual handles,
actual ROI. Nothing generated here proves "graded in public" as convincingly as
a picture of it. Capture one once the board has entrants on it.
