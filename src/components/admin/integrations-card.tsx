import { Plug, Check, X, AlertTriangle } from "lucide-react";
import { integrationStatus, deploymentEnv, type IntegrationState } from "@/lib/integrations";
import { cn } from "@/lib/utils";

/**
 * Which integrations are wired up in the environment serving this page.
 *
 * A server component on purpose: the status is read straight from the running
 * process's env, so there's no API route to secure and no chance of the values
 * reaching the browser. Only booleans and variable names are rendered.
 */

const BADGE: Record<IntegrationState, { label: string; className: string; Icon: typeof Check }> = {
  ok: { label: "Configured", className: "bg-accent/10 text-accent", Icon: Check },
  partial: { label: "Partial", className: "bg-gold/15 text-gold", Icon: AlertTriangle },
  off: { label: "Not set", className: "bg-surface-raised text-muted", Icon: X },
};

export function IntegrationsCard() {
  const integrations = integrationStatus();
  const env = deploymentEnv();
  const broken = integrations.filter((i) => i.critical && i.state !== "ok");
  const partial = integrations.filter((i) => !i.critical && i.state === "partial");

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold">
          <Plug className="h-4 w-4 text-accent" /> Integrations
        </p>
        <span className="rounded-full bg-surface-raised px-2.5 py-1 text-xs font-medium text-muted">
          {env}
        </span>
      </div>

      <p className="mt-1 text-xs text-muted">
        Read from this environment&apos;s variables. A key set on Preview but not Production shows
        as missing here — check the badge above matches the environment you mean.
      </p>

      {(broken.length > 0 || partial.length > 0) && (
        <div className="mt-3 flex flex-col gap-2">
          {broken.length > 0 && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
              Site-critical and not configured: {broken.map((i) => i.label).join(", ")}.
            </p>
          )}
          {partial.length > 0 && (
            <p className="rounded-lg bg-gold/10 px-3 py-2 text-xs font-medium text-gold">
              Half-configured, will fail when used: {partial.map((i) => i.label).join(", ")}.
            </p>
          )}
        </div>
      )}

      <ul className="mt-4 flex flex-col divide-y divide-border">
        {integrations.map((integration) => {
          const badge = BADGE[integration.state];
          return (
            <li key={integration.key} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{integration.label}</span>
                {integration.critical && (
                  <span className="rounded bg-surface-raised px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted">
                    Required
                  </span>
                )}
                <span
                  className={cn(
                    "ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                    badge.className
                  )}
                >
                  <badge.Icon className="h-3 w-3" />
                  {badge.label}
                </span>
              </div>

              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {integration.vars.map((v) => (
                  <span
                    key={v.name}
                    className={cn(
                      "font-mono text-[0.7rem]",
                      v.set ? "text-muted" : v.required ? "text-danger" : "text-muted/60"
                    )}
                    title={v.required ? "Required" : "Optional"}
                  >
                    {v.set ? "✓" : "✗"} {v.name}
                    {!v.required && !v.set && " (optional)"}
                  </span>
                ))}
              </div>

              {integration.state !== "ok" && (
                <p className="text-xs text-muted">{integration.fallback}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
