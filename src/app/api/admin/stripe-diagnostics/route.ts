import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/permissions";
import { stripe } from "@/lib/stripe";

// Superadmin-only diagnostic: reports what Stripe key the *running deployment*
// is using and whether Connect is enabled on that key's account. This pinpoints
// the "you've signed up for Connect" error, which always means the deployed key
// belongs to an account/mode where Connect isn't enabled. Never returns the
// secret itself — only a masked prefix and booleans.
export async function GET() {
  const ctx = await getAdminContext();
  if (!ctx?.isSuperAdmin) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const key = process.env.STRIPE_SECRET_KEY ?? "";
  const keyMode = key.startsWith("sk_live_") || key.startsWith("rk_live_")
    ? "live"
    : key.startsWith("sk_test_") || key.startsWith("rk_test_")
      ? "test/sandbox"
      : key
        ? "unknown"
        : "missing";
  const keyPrefix = key ? `${key.slice(0, 11)}…${key.slice(-4)}` : null;

  // Listing connected accounts requires Connect to be enabled — the same gate
  // that blocks account creation — so it's a safe, read-only probe.
  let connectEnabled = false;
  let connectError: string | null = null;
  let livemode: boolean | null = null;

  try {
    await stripe.accounts.list({ limit: 1 });
    connectEnabled = true;
  } catch (e) {
    connectError = e instanceof Error ? e.message : "Unknown error";
  }

  try {
    // Confirms the key actually works and whether it's a live-mode key.
    const balance = await stripe.balance.retrieve();
    livemode = balance.livemode;
  } catch {
    // Non-fatal — the key-mode string + connect probe are the important parts.
  }

  return NextResponse.json({
    keyConfigured: Boolean(key),
    keyMode,
    keyPrefix,
    livemode,
    connectEnabled,
    connectError,
    webhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
  });
}
