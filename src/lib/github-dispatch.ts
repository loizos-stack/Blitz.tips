import "server-only";

/**
 * Asking a GitHub Actions workflow to run, from the site.
 *
 * Two things need this and neither could be done in the Vercel runtime. The
 * recap render wants a headless browser and ffmpeg. The database backup wants
 * pg_dump, a long-held connection and somewhere to put a file. A runner has
 * all of that; a function has none of it.
 *
 * The backup is here for a second reason, which is the more interesting one: a
 * GitHub `schedule:` is not a schedule. GitHub deprioritises scheduled
 * workflows on quiet repositories and silently skips slots — the nightly
 * backup's 03:17 slot did not fire at all on its first day, and the "hourly"
 * health check managed two runs in eighteen hours. A Vercel cron does fire, so
 * the reliable arrangement is Vercel keeping time and Actions doing the work.
 */

export type DispatchConfig =
  | { ready: true; owner: string; repo: string; ref: string; token: string }
  | { ready: false; missing: string };

/**
 * Where to dispatch, and with what.
 *
 * Reports what is missing rather than throwing, so a page can say "set
 * GITHUB_DISPATCH_TOKEN" and still point at the Actions tab, which works
 * without any of this.
 */
export function githubDispatchConfig(): DispatchConfig {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return { ready: false, missing: "GITHUB_DISPATCH_TOKEN" };

  // Vercel sets these for a Git-linked project, so a correct repo and branch
  // come for free and keep working on a preview deployment of another branch.
  const owner = process.env.GITHUB_REPO_OWNER ?? process.env.VERCEL_GIT_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME ?? process.env.VERCEL_GIT_REPO_SLUG;
  if (!owner || !repo) return { ready: false, missing: "GITHUB_REPO_OWNER / GITHUB_REPO_NAME" };

  // The workflow runs from the branch it is dispatched on, so the branch this
  // deployment was built from is the one whose workflow file matches this code.
  const ref = process.env.GITHUB_REPO_REF ?? process.env.VERCEL_GIT_COMMIT_REF ?? "main";
  return { ready: true, owner, repo, ref, token };
}

/**
 * Start a workflow. Resolves to null on success, else the reason.
 *
 * Inputs must all be strings and GitHub rejects unknown keys outright, so
 * undefined and empty values are dropped rather than sent as "".
 */
export async function dispatchWorkflow(
  config: Extract<DispatchConfig, { ready: true }>,
  workflow: string,
  inputs: Record<string, string | undefined> = {}
): Promise<string | null> {
  const res = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/actions/workflows/${workflow}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: config.ref,
        inputs: Object.fromEntries(
          Object.entries(inputs).filter(([, v]) => v !== undefined && v !== "")
        ),
      }),
    }
  );

  // 204 is the documented success. Anything else carries a reason worth
  // showing: a token without `actions: write`, a branch with no such
  // workflow, a workflow file that failed to parse.
  if (res.status === 204) return null;
  const body = await res.text().catch(() => "");
  let detail = body.slice(0, 300);
  try {
    detail = (JSON.parse(body) as { message?: string }).message ?? detail;
  } catch {
    // Not JSON; the raw text is the best we have.
  }
  return `GitHub returned ${res.status}${detail ? `: ${detail}` : ""}`;
}
