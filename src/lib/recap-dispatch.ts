import "server-only";

/**
 * Starting a recap render from the admin panel.
 *
 * The render itself cannot happen here. It needs a headless browser and
 * ffmpeg, and the Vercel runtime has neither — which is why it lives in a
 * GitHub Actions workflow (.github/workflows/recap-video.yml). That workflow
 * no longer runs on a schedule, so something has to ask it to run, and this is
 * that something: it pokes the workflow_dispatch endpoint with the date and
 * the handicappers the admin chose.
 *
 * The one thing it needs that the site doesn't already have is a GitHub token
 * with permission to start a workflow. Rather than fail obscurely when it is
 * missing, `recapDispatchConfig` reports what is absent so the page can say so
 * and still point at the Actions tab, which works without any of this.
 */

export const RECAP_WORKFLOW = "recap-video.yml";

export type DispatchConfig =
  | { ready: true; owner: string; repo: string; ref: string; token: string }
  | { ready: false; missing: string };

export function recapDispatchConfig(): DispatchConfig {
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

export type DispatchInputs = {
  date: string;
  mode: "recap" | "winners";
  to?: string;
  handicappers?: string;
  tiktok?: boolean;
};

/** Ask GitHub to run the render. Resolves to null on success, else the reason. */
export async function dispatchRecapRender(
  config: Extract<DispatchConfig, { ready: true }>,
  inputs: DispatchInputs
): Promise<string | null> {
  const res = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/actions/workflows/${RECAP_WORKFLOW}/dispatches`,
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
        // GitHub rejects a dispatch whose inputs aren't all strings, and
        // rejects unknown keys outright, so empty optionals are dropped
        // rather than sent as "".
        inputs: Object.fromEntries(
          Object.entries({
            date: inputs.date,
            mode: inputs.mode,
            to: inputs.to,
            handicappers: inputs.handicappers,
            tiktok: inputs.tiktok ? "true" : undefined,
          }).filter(([, v]) => v !== undefined && v !== "")
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
