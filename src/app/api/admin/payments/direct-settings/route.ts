import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { logAdmin } from "@/lib/audit";
import { directPaymentSettings, saveDirectPaymentSettings } from "@/lib/direct-payments";

/**
 * Turn off-platform payment on, and say where the money should go.
 *
 * The instructions are shown verbatim to a paying customer, so they are the
 * one thing here that has to be right: an account number with a digit missing
 * sends somebody's money to a stranger. Nothing validates them — nothing
 * could — which is why they are typed by an admin and never derived.
 */
export async function POST(request: Request) {
  const ctx = await requirePermission("financials");
  if (!ctx) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const enabled = body?.enabled === true;
  const methods: string[] = Array.isArray(body?.methods)
    ? body.methods.filter((m: unknown): m is string => typeof m === "string" && m.trim() !== "")
        .map((m: string) => m.trim().slice(0, 40))
        .slice(0, 8)
    : [];
  const instructions =
    typeof body?.instructions === "string" ? body.instructions.trim().slice(0, 2000) : "";

  // Refusing to switch on without somewhere to send people is the whole
  // safety margin here: an enabled button with blank instructions asks a
  // customer to transfer money to nobody.
  if (enabled && (methods.length === 0 || !instructions)) {
    return NextResponse.json(
      { error: "Add at least one method and the payment details before turning this on." },
      { status: 400 }
    );
  }

  await saveDirectPaymentSettings({ enabled, methods, instructions });
  await logAdmin(
    ctx.session,
    "payments.direct.settings",
    "SiteSetting",
    "payments.direct",
    `${enabled ? "enabled" : "disabled"}; methods: ${methods.join(", ") || "none"}`
  );

  return NextResponse.json({ ok: true, settings: await directPaymentSettings() });
}
