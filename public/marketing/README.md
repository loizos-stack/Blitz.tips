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
| `supercapper-starts-1600x900.png` | 1600×900 | "Starts Aug 3" — the pre-launch push |
| `supercapper-dates-1600x900.png` | 1600×900 | Key dates, both ends, with the enter-anytime caveat |
| `supercapper-starts-square-1080.png` | 1080×1080 | "Starts Aug 3", square |
| `supercapper-countdown-1080x1350.png` | 1080×1350 | Season run, portrait |
| `supercapper-x-money-dates-1600x900.png` | 1600×900 | Money + dates, the default X post |
| `supercapper-x-payout-1600x900.png` | 1600×900 | How the pool pays — answers "will I actually get paid" |
| `supercapper-x-money-dates-1080x1350.png` | 1080×1350 | Money + dates, portrait (more mobile feed space) |
| `supercapper-x-bold-1600x900.png` | 1600×900 | Type-only, no wordmark lockup — stands out in a scroll |

## Video

`supercapper-promo-1080x1920.mp4` — 13s, 9:16, H.264/yuv420p, ~1.4MB. Built by
`scripts/build-promo-video.mjs`:

```bash
npm run build
node scripts/build-promo-video.mjs      # needs ffmpeg; falls back to imageio-ffmpeg
```

Frames are driven by an explicit clock rather than CSS animations, so frame N is
identical on every run regardless of machine speed.

**It has no audio, deliberately.** TikTok and Reels expect you to add trending
sound in the app — a baked-in track is a licensing problem and the first thing a
creator would mute. Post it and pick audio on the platform.

9:16 covers TikTok, Reels, Shorts and Stories. Keep the important content away
from the top and bottom ~15%, where the platform UI sits — the current cut keeps
everything in the middle band for that reason.

## Dates

`STARTS` / `ENDS` at the top of the script are the seeded contest window —
**August 3, 2026 → January 10, 2027** — taken from the `Contest` row's `startsAt`
and `endsAt`.

Verify against the live row before publishing. An admin can change these in the
contests panel without a migration, and no migration since the original one has
touched them — so the seeded values are the best available source here, not
proof of what production currently holds. The prize pool has already been edited
once, which is exactly how these drift.

`registrationClosesAt` is null, so entries stay open until `endsAt`. That's why
the dates card says "enter any time" rather than advertising a registration
deadline — there isn't one.

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
