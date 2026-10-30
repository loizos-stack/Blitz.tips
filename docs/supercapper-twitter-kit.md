# Supercapper — X/Twitter marketing kit

Copy is written to be posted as-is. Every number here is pulled from the live
contest config, not rounded for effect — check `src/lib/contest.ts` and the
`Contest` row before changing any of it.

## The facts you're allowed to claim

| Claim | Source |
|---|---|
| $10,000 guaranteed prize pool | `prizePoolCents = 1000000` |
| Free to enter | no entry fee anywhere in the join flow |
| Best volume-adjusted ROI wins | `contestStandings` |
| 100 graded picks to be prize-eligible | `minPicks = 100` |
| Paid places start at 3; the 4th opens at 30 entrants, the 5th at 40 | `payoutSpotsForEntrants` |
| Full pool always paid out | ICM chop across open places |

**Do not** claim "top 20 paid" as a flat fact. Twenty places is the *ladder*;
the number actually paying depends on entrant count. With 30 entrants it's 4
places sharing $10,000. Saying "top 20 paid" to a field of 30 is false and
someone will screenshot it.

**Do not quote a fixed first prize.** This file used to claim "$3,100 for 1st",
taken from `DEFAULT_SUPERCAPPER_SPLIT_CENTS[0]`. That array only prefills the
admin form. The contest runs with `dynamicPayouts` on, so the real ladder comes
from `contestPrizeLadderCents(poolCents, payoutSpotsForEntrants(n))` and moves
with the field:

| Entrants | Paid places | 1st | 2nd | 3rd |
|---|---|---|---|---|
| under 30 | 3 | $4,467 | $3,217 | $2,316 |
| 30–39 | 4 | $3,829 | $2,757 | $1,985 |
| 40–49 | 5 | $3,472 | $2,500 | $1,800 |
| 50–99 | 6 | $3,253 | $2,342 | $1,686 |
| 100 | 11 | $2,878 | $2,072 | $1,492 |

$10,000 is guaranteed and always fully paid; only the split moves. Quote the
pool, not a place. If you want a number for 1st, read it off the live contest
page rather than this table — the table is a snapshot of the formula, not of
the row.

**Note the direction.** A small field means a *bigger* first prize, not a
smaller one. That's the honest early-entrant pitch, and it's the opposite of
what people assume.

---

## 1. Pinned launch post

> $10,000. Free to enter. No picks for sale.
>
> The Supercapper contest: post your plays, every one graded in public, best
> ROI at the end takes the biggest slice of a guaranteed $10K.
>
> No Discord. No screenshots. No "check my highlights."
>
> Just a record that anyone can audit.
>
> blitz.tips/supercapper

## 2. Launch thread

**1/**
> We're putting up $10,000 to settle an argument.
>
> Everyone on this app says they're up. Almost nobody posts a record you can
> check.
>
> So: free contest, public grading, $10K guaranteed. Best ROI wins.
>
> Here's how it works 🧵

**2/**
> Every pick you post is timestamped against live odds and graded automatically
> when the game settles.
>
> You can't delete a loser. You can't move a line after the fact. You can't
> "count that as a lean."
>
> The record is the product.

**3/**
> Winner is decided on ROI, not units won.
>
> Volume-adjusted, so you can't win it by going 3-0 and sitting out. Someone
> grinding 400 picks at +4% beats someone who hit a 3-teamer in March.

**4/**
> The bar: 100 graded picks to be prize-eligible.
>
> Saying that up front because it's the part people miss. This isn't a one-week
> parlay sprint — it's a season-long record. If that's not your thing, this
> contest isn't either.

**5/**
> Payouts scale with the field. It starts at 3 paid places and adds one for
> every 10 entrants.
>
> The whole $10,000 gets paid regardless of how many people show up. Small
> field just means everyone's slice is bigger.

**6/**
> Free. No card, no sub, no "DM for access."
>
> If you've got a record worth showing, this is where you show it.
>
> blitz.tips/supercapper

## 3. Recurring posts

Rotate these — one every few days beats posting the launch thread again.

**Early-entrant urgency** (replace the numbers with the live count):
> Current field: {N} entrants → {P} paid places.
>
> Every 10 people who join opens another one. Right now your odds of finishing
> in the money are the best they will ever be.
>
> blitz.tips/supercapper

**Consensus page**:
> Where the contest field is actually betting tonight 👇
>
> Every entrant's picks, sorted by league and match. When the field splits on a
> game, you can see the split.
>
> blitz.tips/supercapper/consensus

**Standings**:
> {N} picks graded. Here's the top of the board.
>
> [screenshot of standings]
>
> Still free to enter, still $10,000, still anyone's.

**The differentiator** (works as a standalone quote-tweet reply to capper hype):
> Genuine question for the "up 40 units" accounts: at what stake, over how many
> picks, closing at what number?
>
> We built a contest where you don't have to answer — the site answers for you.
>
> $10K, free, graded in public.

**Fade-the-field angle**:
> Contest consensus is public.
>
> If 80% of the field is on one side and you think they're wrong, that's free
> information. Use it however you like.

## 4. Bio / profile

> Verified sports handicapping. Every pick tracked, graded, ranked.
> $10,000 Supercapper contest — free to enter 👇

---

## Visual assets to make

The copy carries more with an image attached. In priority order:

1. **The Supercapper logo card** — already built (`SupercapperLogo`, gold bolt,
   "Handicapping Contest", Blitz.tips byline). Export at 1600×900 for the pinned
   post.
2. **A standings screenshot** — real names, real ROI. Most credible asset you
   have; nothing else proves "graded in public" as fast.
3. **A single graded pick card** — the shareable pick card already exists in the
   dashboard. Shows the timestamp-and-grade mechanic in one frame.
4. **Consensus page screenshot** — league → match → market with crests. Visually
   the most distinctive page on the site.

## Posting notes

- **Time it to the slate.** Post recurring content 2–4 hours before the day's
  main card, not at 9am.
- **Never quote-tweet a specific capper as a mark.** The contest sells against
  the *category*, not a named person — punching down at one account starts a
  fight that makes you look small and gets you blocked by their audience.
- **Screenshots beat claims.** A standings image outperforms any sentence in
  this file.

## Compliance

- The contest is free to enter and pays cash, so it isn't gambling — but the
  audience and subject are. Keep **18+ (21+ where applicable)** and a
  responsible-gambling line on the profile, and on any post that mentions odds
  or betting directly.
- Never imply picks are a reliable income, and never present past ROI as
  predictive. "Best record wins a prize" is fine; "make money following our
  cappers" is not.
- Paid promotion of betting content is restricted on X in many jurisdictions and
  needs prior authorization. Organic posting is fine — **check before spending
  on ads.**
- If the prize pool or the 100-pick threshold ever changes, this file and every
  scheduled post have to change with it. A stale "$25,000" post outliving the
  change is exactly the kind of thing that gets screenshotted back at you.
