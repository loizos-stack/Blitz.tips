#!/usr/bin/env sh
# Apply pending migrations, retrying if the database was asleep.
#
# Neon suspends its compute after a few minutes of no traffic, and the first
# connection afterwards is refused rather than queued - `prisma migrate deploy`
# comes straight back with P1001, "Can't reach database server", about a second
# after it starts. A build that happens to be the first thing to touch the
# database in a quiet hour therefore fails for no reason of its own, before a
# line of the app has been compiled.
#
# To be clear about what this does not do: when the database is genuinely
# unreachable, retrying cannot help, and the build should fail. Both builds of
# 926865f on 2026-11-26 failed here, 90 seconds apart, and would have failed
# again with this script in place - that was an outage, not a nap. The point of
# the retries is to stop a one-second refusal from costing a deploy, and the
# log line below is what distinguishes the two cases afterwards.
#
# Retrying is safe because `migrate deploy` is idempotent: it applies the
# migrations recorded as pending and does nothing when there are none. Two
# retries, 5s and 15s, which is comfortably longer than a Neon wake and short
# enough that a database which is genuinely down still fails the build inside
# half a minute rather than hanging it.
#
# This is a workaround for the symptom. The cause is the autosuspend delay on
# the Neon compute endpoint; raising it there removes the need for this.
set -e

attempt=1
for delay in 5 15 0; do
  if npx prisma migrate deploy; then exit 0; fi
  if [ "$delay" -eq 0 ]; then break; fi
  echo "migrate deploy attempt ${attempt} failed - the database may have been asleep; retrying in ${delay}s"
  attempt=$((attempt + 1))
  sleep "$delay"
done

echo "migrate deploy failed after ${attempt} attempts" >&2
exit 1
