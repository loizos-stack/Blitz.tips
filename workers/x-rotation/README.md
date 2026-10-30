# X posting schedule (Cloudflare Cron Worker)

Fires the site's posting rotation five times a day.

Blitz runs on Vercel's Hobby plan, which allows **daily cron jobs only**. It does
not quietly degrade a more frequent schedule — it rejects the deployment
outright. Posting every four to five hours therefore needs a scheduler that
lives somewhere else, and this is it: about thirty lines of Worker calling one
route on blitz.tips.

The split is deliberate. The app decides *what* to post and *whether* to send
it; the Worker only decides *when* to ask. The posting logic stays in the
codebase where it is reviewed and tested, and the piece deployed by hand stays
small enough to read in one sitting. Changing the rotation — reordering slots,
adding a kind of post, changing the words — is a change to `src/lib/x-rotation.ts`
with no Cloudflare edit.

## One-time setup

```bash
cd workers/x-rotation
npm install
npx wrangler login
npx wrangler deploy
npx wrangler secret put CRON_SECRET   # the same value as CRON_SECRET on the site
```

`CRON_SECRET` must be a **secret**, not a `[vars]` entry — it is the only thing
between the public internet and the X account posting. `SITE_URL` is a plain
variable in `wrangler.toml` and can stay as it is.

The cron triggers deploy with the Worker; there is nothing to click in the
dashboard.

## The schedule

| UTC | ET | Slot |
|---|---|---|
| 12:00 | 08:00 | Today's board |
| 16:00 | 12:00 | Gold capper |
| 20:00 | 16:00 | Leaderboard |
| 00:00 | 20:00 | A pick that landed |
| 03:00 | 23:00 | For handicappers |

Which slot belongs to which hour is decided by the site, in
`src/app/api/cron/x-post/route.ts`. The times above only have to agree with it
loosely: a firing is attributed to the most recent slot hour within the last two
hours, because Cloudflare describes cron as best-effort and a trigger set for
16:00 can land at 16:07.

Daylight saving is not handled — these are fixed UTC times, so the slots drift
by an hour against ET twice a year. Not worth a scheduler to fix.

## Posts wait for approval by default

A composed post lands in **Admin → X** as pending and goes nowhere until someone
presses Send. Flip **Post automatically** on that page once the copy reads the
way you want it to; the toggle is a site setting, so it takes effect on the next
firing with no deploy.

## Checking it works

```bash
curl -i -X POST https://blitz-x-rotation.<your-subdomain>.workers.dev \
  -H "Authorization: Bearer <CRON_SECRET>"
```

A 200 with a JSON body means the Worker reached the site and the site answered.
A 401 means the secret does not match on one side or the other.

`npx wrangler tail` shows firings live, and the dashboard keeps recent ones under
the Worker's **Logs**. That is where to look when a slot is silent: the site
answers `{"outcome":"skipped","detail":…}` when it decided there was nothing
worth posting, which is a different problem from the Worker never firing, and
only the logs tell them apart.

## If you move to Vercel Pro

Delete the Worker and put the same five schedules in `vercel.json` pointing at
`/api/cron/x-post`. The route does not change.
