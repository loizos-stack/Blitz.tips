import "server-only";
import { randomBytes } from "crypto";
import { getSetting, setSetting } from "@/lib/settings";

/**
 * Paying for a pass off-platform.
 *
 * Stripe reaches handicappers in the EEA, the UK, the US, Canada and
 * Switzerland and nowhere else, and crypto doesn't suit every subscriber.
 * This is the third route: the subscriber sends the money straight to the
 * platform by whatever means the admin accepts — bank transfer, PayPal,
 * Revolut, Wise — an admin confirms it arrived, and the handicapper's share
 * goes out by hand and is recorded against them.
 *
 * It is deliberately not an integration. There is no provider to onboard with
 * and no API key, which is the point: it works in every country on day one,
 * and nothing here depends on a payment processor's view of what this site
 * sells. The cost is that a person has to confirm each payment, so the
 * subscriber is told plainly that access starts when it is checked.
 */

export const DIRECT_ENABLED_KEY = "payments.direct.enabled";
export const DIRECT_METHODS_KEY = "payments.direct.methods";
export const DIRECT_INSTRUCTIONS_KEY = "payments.direct.instructions";

export type DirectPaymentSettings = {
  enabled: boolean;
  /** The methods offered, in the order they are shown. */
  methods: string[];
  /** Where to send the money — free text, shown after a request is made. */
  instructions: string;
};

/** Sensible starting point for the settings form, not a default that is live. */
export const SUGGESTED_METHODS = ["Bank transfer", "PayPal", "Revolut", "Wise"];

export async function directPaymentSettings(): Promise<DirectPaymentSettings> {
  const [enabled, methods, instructions] = await Promise.all([
    getSetting(DIRECT_ENABLED_KEY),
    getSetting(DIRECT_METHODS_KEY),
    getSetting(DIRECT_INSTRUCTIONS_KEY),
  ]);

  const parsed = (methods ?? "")
    .split("\n")
    .map((m) => m.trim())
    .filter(Boolean);

  return {
    // Only on when it has somewhere to send people. An enabled option with no
    // instructions is a button that takes money nowhere.
    enabled: enabled === "true" && parsed.length > 0 && Boolean(instructions?.trim()),
    methods: parsed,
    instructions: instructions ?? "",
  };
}

export async function saveDirectPaymentSettings(s: {
  enabled: boolean;
  methods: string[];
  instructions: string;
}): Promise<void> {
  await Promise.all([
    setSetting(DIRECT_ENABLED_KEY, s.enabled ? "true" : "false"),
    setSetting(DIRECT_METHODS_KEY, s.methods.map((m) => m.trim()).filter(Boolean).join("\n")),
    setSetting(DIRECT_INSTRUCTIONS_KEY, s.instructions.trim()),
  ]);
}

/**
 * The code the payer quotes on the transfer.
 *
 * Short enough to retype into a bank's reference box without a mistake, and
 * from an alphabet with no 0/O or 1/I/L, because it gets read off a screen and
 * typed into a different one. Collisions are caught by the unique column; the
 * caller retries.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function paymentReference(): string {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return `BT-${out.slice(0, 4)}-${out.slice(4)}`;
}
