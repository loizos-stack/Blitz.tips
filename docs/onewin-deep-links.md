# 1win deep links

1win publishes no deep-link API, so the URL shape here is reverse-engineered
from real links and the id half of each segment has to be **collected, not
derived**.

## The shape

```
https://one-vv0199.com/betting/prematch/football-18/uefa-europa-league-39438?p=u53a
                      └─ path ─┘└ sect ┘└  sport  ┘└     competition      ┘└ partner ┘
```

Both `football-18` and `uefa-europa-league-39438` are `{slug}-{id}`. The slug
looks derivable from a name; **the id is not**. It is an opaque key from 1win's
database, and no rule turns "Premier League" into the right number. A guessed id
is a 404 wearing the costume of a working affiliate link — worse than landing one
level up, because it looks fine in review and only fails for the customer.

So `src/lib/onewin.ts` carries a table where every entry is either copied from a
link someone actually opened (`verified: true`) or ignored at build time.

## What it does with a partial table

It degrades one level at a time, and every outcome is a page that exists:

| Known | Destination |
|---|---|
| Competition | `/betting/prematch/football-18/uefa-europa-league-39438` |
| Sport only | `/betting/prematch/football-18` |
| Neither | `/betting` |

So the table can be filled in gradually. Nothing breaks while it is incomplete —
links just land less specifically.

## Collecting the rest

The site can't be crawled from CI (and isn't reachable from the dev sandbox at
all), so this is a browser job. Open 1win while signed in, go to **Betting →
Prematch**, expand the sports you care about in the left-hand list, then paste
this into the browser console:

```js
// Scrapes every /betting/prematch/... link currently in the DOM and prints the
// table rows to paste into LEAGUE_SEGMENTS. Expand a sport in the sidebar first
// — only rendered links can be read.
copy(
  [...document.querySelectorAll('a[href*="/betting/prematch/"]')]
    .map((a) => new URL(a.href).pathname.split("/").filter(Boolean))
    // ["betting","prematch","football-18","uefa-europa-league-39438"]
    .filter((p) => p.length === 4)
    .map(([, , sport, league]) => ({ sport, league, name: "" }))
    .filter((v, i, arr) => arr.findIndex((x) => x.league === v.league) === i)
    .map((v) => `  // ${v.sport}\n  ${v.league}`)
    .join("\n")
);
console.log("copied to clipboard");
```

Then paste the result back and it can be matched to our league keys. The mapping
target is the Odds-API key each competition already carries in our data —
`UpcomingEvent.sportKey` / `Pick.oddsApiSportKey`, e.g. `soccer_epl`,
`soccer_uefa_champs_league`, `basketball_nba`.

If the console is awkward, copying the address bar from a handful of competition
pages works just as well — each URL is one complete table row.

## Priority

Sport sections first: six of them cover every link on the site, since an
unmapped competition falls back to its sport.

| Our sport | Needs |
|---|---|
| SOCCER | ✅ `football-18` |
| NBA / WNBA / NCAAB | basketball section |
| NHL | ice-hockey section |
| MLB | baseball section |
| NFL / NCAAF | american-football section |
| MMA | MMA section |

Then competitions, most-trafficked first — the top-five European leagues and the
UEFA competitions account for most soccer traffic on the board.

## Per-fixture links

Not possible yet. A single match would be the best destination of all, but its id
lives in 1win's database and nothing we hold maps to it. `event` is carried
through `/api/go/onewin` for click analytics only. If the affiliate manager ever
provides a fixture URL format, it slots in beside the competition segment.
