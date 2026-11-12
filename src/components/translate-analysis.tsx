"use client";

import { useState, useSyncExternalStore } from "react";
import { Languages, Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";

/**
 * The reader's language, read through useSyncExternalStore so the server
 * renders "unknown" and the browser renders the real answer, with no
 * hydration mismatch and no setState in an effect.
 *
 * `navigator.language` cannot change without a reload, so there is nothing to
 * subscribe to — hence the no-op subscribe, defined once so React doesn't
 * resubscribe on every render.
 */
const noopSubscribe = () => () => {};
const readViewerLang = () =>
  (navigator.language || "en").toLowerCase().split(/[-_]/)[0] || "en";
/** Null on the server: unknown reader, so no button in the initial HTML. */
const noViewerLang = () => null;

/**
 * A pick's write-up, with a translate button under it.
 *
 * The reader's own language comes from the browser rather than a picker: a
 * person who cannot read the tip also cannot read a dropdown labelled in the
 * language they don't speak. One tap, their language, back to the original
 * whenever they want.
 *
 * The button is decided on the client on purpose. `navigator.language` does
 * not exist during a server render, and guessing from an Accept-Language
 * header would make this page's cached HTML differ per reader. So the server
 * sends one HTML for everyone and the button appears — or doesn't — once the
 * browser says who is reading.
 */
export function TranslateAnalysis({
  pickId,
  analysis,
  /** The language the write-up is in, where we have learned it. */
  analysisLang,
}: {
  pickId: string;
  analysis: string;
  analysisLang?: string | null;
}) {
  const viewerLang = useSyncExternalStore<string | null>(
    noopSubscribe,
    readViewerLang,
    noViewerLang
  );
  const [translated, setTranslated] = useState<string | null>(null);
  const [showing, setShowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sameLanguage, setSameLanguage] = useState(false);

  async function translate() {
    if (!viewerLang) return;
    setBusy(true);
    setError(null);
    const res = await fetchJson<{ text: string; sameLanguage: boolean }>(
      `/api/picks/${pickId}/translate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: viewerLang }),
      }
    );
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Couldn't translate that.");
      return;
    }
    if (res.data?.sameLanguage) {
      // Nothing to show — saying so is better than swapping the text for an
      // identical copy and looking broken.
      setSameLanguage(true);
      return;
    }
    setTranslated(res.data?.text ?? null);
    setShowing(true);
  }

  // Hidden when we already know the write-up is in the reader's language, and
  // until the browser has told us what that is.
  const offer = viewerLang !== null && analysisLang !== viewerLang && !sameLanguage;

  return (
    <div className="mt-3">
      <p className="text-sm text-muted">{showing && translated ? translated : analysis}</p>

      {offer && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {translated ? (
            <button
              type="button"
              onClick={() => setShowing((s) => !s)}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-accent"
            >
              <Languages className="h-3.5 w-3.5" />
              {showing ? "Show original" : "Show translation"}
            </button>
          ) : (
            <button
              type="button"
              onClick={translate}
              disabled={busy}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-accent disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Languages className="h-3.5 w-3.5" />
              )}
              {busy ? "Translating…" : "Translate"}
            </button>
          )}
          {showing && translated && <span className="text-[11px] text-muted">Machine translation</span>}
          {error && <span className="text-[11px] text-danger">{error}</span>}
        </div>
      )}
    </div>
  );
}
