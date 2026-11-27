import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { dispatchWorkflow, githubDispatchConfig } from "@/lib/github-dispatch";

export const dynamic = "force-dynamic";

export const BACKUP_WORKFLOW = "backup-db.yml";

/**
 * Nightly database backup — the timekeeper, not the work.
 *
 * The dump runs in GitHub Actions, because it needs pg_dump, a long-held
 * connection and somewhere to put a file, none of which a function has. But
 * the workflow's own `schedule:` cannot be relied on to start it: GitHub
 * deprioritises scheduled workflows on quiet repositories and skips slots
 * without saying so. On its first day the 03:17 slot did not fire at all, and
 * the "hourly" health check managed two runs in eighteen hours.
 *
 * So Vercel keeps time and Actions does the work. A Vercel cron does fire.
 *
 * This endpoint only asks; it does not wait. A dump takes twenty-odd seconds
 * and a function that waited would be holding a request open for a result
 * nobody reads — the workflow reports itself, and a failing run emails the
 * repository owner.
 *
 * The failure worth naming: a SKIPPED backup is silent, where a failed one is
 * not. That is exactly why this exists, and it is also why this route returns
 * what it asked for and what GitHub said, so an admin opening it by hand can
 * tell "asked and started" from "asked and refused".
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && request.headers.get("authorization") === `Bearer ${cronSecret}`;
  const isAdmin = !isCron && (await requirePermission("system"));
  if (!isCron && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = githubDispatchConfig();
  if (!config.ready) {
    // 503 rather than 500: nothing is broken, something is unset. Said out
    // loud, with the name of the thing, because the alternative is a backup
    // that quietly never runs — the state this whole route exists to end.
    return NextResponse.json(
      {
        ok: false,
        error: `Cannot start the backup: ${config.missing} is not set on this deployment.`,
      },
      { status: 503 }
    );
  }

  const failure = await dispatchWorkflow(config, BACKUP_WORKFLOW);
  if (failure) {
    return NextResponse.json({ ok: false, error: failure }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    dispatched: BACKUP_WORKFLOW,
    ref: config.ref,
    note: "The dump runs in GitHub Actions; see the repository's Actions tab for the result.",
  });
}
