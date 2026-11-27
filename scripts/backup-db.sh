#!/usr/bin/env bash
# Take a restorable backup of the database.
#
# Written on 2026-11-26, the day the Neon compute was suspended for exhausting
# its monthly CU-hours and the site was down for four hours. The data was never
# at risk, but it was unreachable — and that exposed something worse than the
# outage: there was no backup, and no way to make one, because a suspended
# compute accepts no connections. Moving to another provider was impossible for
# the same reason. Whatever is in Postgres existed in exactly one place.
#
# Format is pg_dump's custom format rather than plain SQL. It is compressed, it
# can be restored selectively with pg_restore, and — the reason that matters
# here — `pg_restore --list` can read its table of contents, so a backup can be
# proved readable without restoring it anywhere. A .sql file can only be
# verified by running it.
#
# --no-owner and --no-acl because Neon's roles do not exist on whatever this is
# restored into, and a restore that fails on GRANT statements is a backup that
# only looked like one.
#
# To restore into an empty database:
#
#   pg_restore --no-owner --no-acl -d "$TARGET_DATABASE_URL" blitz-<stamp>.dump
#
# To inspect one without restoring:
#
#   pg_restore --list blitz-<stamp>.dump
#
# Usage: DATABASE_URL=postgres://... scripts/backup-db.sh [output-dir]
set -euo pipefail

OUT_DIR="${1:-backups}"
# The pooled URL is fine for queries and wrong for this: pg_dump wants one
# session it can hold open, which is what DIRECT_URL is for. Falls back so the
# script still works where only one is set.
URL="${DIRECT_URL:-${DATABASE_URL:-}}"

if [ -z "$URL" ]; then
  echo "::error::Neither DIRECT_URL nor DATABASE_URL is set — nothing to back up." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$OUT_DIR/blitz-$STAMP.dump"

echo "Dumping to $FILE"
pg_dump --format=custom --no-owner --no-acl --file="$FILE" "$URL"

BYTES=$(stat -c%s "$FILE")
echo "Wrote $FILE ($(( BYTES / 1024 )) KB)"

# A dump that succeeded but produced almost nothing is the failure mode worth
# catching: an empty database, a wrong URL, or a connection cut partway. The
# floor is deliberately low — it is here to catch "essentially nothing", not to
# assert a size.
if [ "$BYTES" -lt 10240 ]; then
  echo "::error::Dump is only ${BYTES} bytes, which is too small to be this database." >&2
  exit 1
fi

# Prove the file is readable as an archive before calling it a backup. This is
# the whole difference between having backups and believing you do.
TABLES=$(pg_restore --list "$FILE" | grep -c " TABLE DATA " || true)
echo "Archive is readable: $TABLES tables with data"

if [ "$TABLES" -lt 5 ]; then
  echo "::error::Only $TABLES tables carry data — this does not look like a full dump." >&2
  exit 1
fi

echo "$FILE"
