/**
 * Asks blitz.tips to run one X posting slot.
 *
 * Cloudflare fires this on the cron schedule in wrangler.toml. Every firing is
 * one HTTP request; the site works out which slot is due, whether it has the
 * data to fill it, and whether to send or queue. Nothing about the rotation is
 * decided here, on purpose — this file is deployed separately from the site, so
 * keeping it ignorant means the two can never disagree about what to post.
 */
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(run(env));
  },

  // A manual trigger, so the schedule can be tested without waiting for it.
  // Requires the same secret as the cron path: Workers get a workers.dev
  // hostname whether you want one or not, so this URL is public.
  async fetch(request, env) {
    const auth = request.headers.get("authorization");
    if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    const result = await run(env);
    return new Response(JSON.stringify(result, null, 2), {
      headers: { "content-type": "application/json" },
    });
  },
};

async function run(env) {
  const site = env.SITE_URL || "https://blitz.tips";
  try {
    const res = await fetch(`${site}/api/cron/x-post`, {
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
      // A posting run is short. If the site is wedged, failing now beats
      // holding the invocation open; the next firing tries again.
      signal: AbortSignal.timeout(25_000),
    });
    const body = await res.text();
    // Worker logs are the only place a failure surfaces, so say enough to
    // diagnose from them alone.
    console.log(`x-post ${res.status}: ${body.slice(0, 300)}`);
    return { status: res.status, body: body.slice(0, 300) };
  } catch (err) {
    console.error(`x-post request failed: ${err}`);
    return { status: 0, error: String(err) };
  }
}
