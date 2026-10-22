"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  DEFAULT_ODDS_FORMAT,
  ODDS_FORMAT_COOKIE,
  ODDS_FORMAT_COOKIE_MAX_AGE,
  formatOddsAs,
} from "@/lib/odds-format";
import type { OddsFormat } from "@/lib/odds-format";

/**
 * The visitor's odds format, shared by every price on the page.
 *
 * The provider is seeded server-side from the cookie, so the first paint is
 * already in the chosen format — the point of using a cookie rather than
 * localStorage.
 *
 * Because every price renders through <Odds/>, which is a client component
 * reading this context, switching format re-renders the prices in place. No
 * router.refresh() and no round trip: server components hand <Odds/> the stored
 * American number as a prop and the conversion happens at render.
 */
const OddsFormatContext = createContext<OddsFormat>(DEFAULT_ODDS_FORMAT);
const SetOddsFormatContext = createContext<(next: OddsFormat) => void>(() => {});

export function OddsFormatProvider({
  initial,
  children,
}: {
  initial: OddsFormat;
  children: ReactNode;
}) {
  const [format, setFormat] = useState<OddsFormat>(initial);

  const update = useCallback((next: OddsFormat) => {
    setFormat(next);
    // Written from the browser rather than through a server action: it is a
    // display preference, and a round trip would only delay the repaint that
    // the state change has already done.
    const secure = window.location.protocol === "https:" ? "; secure" : "";
    document.cookie =
      `${ODDS_FORMAT_COOKIE}=${next}; path=/; max-age=${ODDS_FORMAT_COOKIE_MAX_AGE}; samesite=lax${secure}`;
  }, []);

  return (
    <OddsFormatContext.Provider value={format}>
      <SetOddsFormatContext.Provider value={update}>{children}</SetOddsFormatContext.Provider>
    </OddsFormatContext.Provider>
  );
}

export function useOddsFormat(): OddsFormat {
  return useContext(OddsFormatContext);
}

export function useSetOddsFormat(): (next: OddsFormat) => void {
  return useContext(SetOddsFormatContext);
}

/**
 * A single price, written in whichever format the visitor picked.
 *
 * `value` is always the stored American number. Rendering through one component
 * — rather than each caller formatting for itself — is what lets a server
 * component show a client-side preference at all, and keeps the two from
 * drifting apart.
 */
export function Odds({ value }: { value: number }) {
  const format = useOddsFormat();
  return <>{useMemo(() => formatOddsAs(value, format), [value, format])}</>;
}
