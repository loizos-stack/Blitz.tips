/**
 * Cookie-consent state, shared by the prompt and the analytics gate.
 *
 * Not server-only — both consumers are client components. localStorage rather
 * than a cookie because nothing server-side needs to read it, and a consent
 * record that itself sets a cookie invites an obvious question.
 */

export const CONSENT_KEY = "blitz.cookieConsent.v1";

/** Fired when the visitor answers, so the analytics gate reacts without a reload. */
export const CONSENT_EVENT = "blitz:cookie-consent";

export type ConsentValue = "accepted" | "declined";

export function readConsent(): ConsentValue | null {
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    return raw === "accepted" || raw === "declined" ? raw : null;
  } catch {
    // Storage blocked (private mode, hardened browser). Unanswered is the safe
    // reading: it means the gate withholds analytics where consent is required.
    return null;
  }
}

export function writeConsent(value: ConsentValue) {
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    /* storage unavailable — the prompt reappears next visit */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
}

/**
 * Whether cookie-setting analytics may load right now.
 *
 * Where consent is required, silence is a "no" — the ePrivacy rule is opt-in,
 * so an unanswered prompt must not be read as permission.
 */
export function analyticsAllowed(consentRequired: boolean, consent: ConsentValue | null): boolean {
  if (!consentRequired) return true;
  return consent === "accepted";
}
