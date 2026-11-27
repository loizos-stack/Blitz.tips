import "server-only";
import {
  dispatchWorkflow,
  githubDispatchConfig,
  type DispatchConfig,
} from "@/lib/github-dispatch";

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
 * The mechanics of dispatching moved to lib/github-dispatch when the database
 * backup needed the same thing. What stays here is the recap's own shape: its
 * workflow file and its inputs.
 */

export const RECAP_WORKFLOW = "recap-video.yml";

export type { DispatchConfig };

export const recapDispatchConfig = githubDispatchConfig;

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
  return dispatchWorkflow(config, RECAP_WORKFLOW, {
    date: inputs.date,
    mode: inputs.mode,
    to: inputs.to,
    handicappers: inputs.handicappers,
    tiktok: inputs.tiktok ? "true" : undefined,
  });
}
