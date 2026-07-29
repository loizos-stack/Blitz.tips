import { Globe } from "lucide-react";
import { getSoccerFeedDiagnostics } from "@/lib/odds-api";

/**
 * What the soccer board resolved to, right now.
 *
 * "Why isn't the Europa League showing, and why is there no handicap or goal
 * line?" has half a dozen possible answers that all look the same from the
 * outside: the competition isn't active on the plan, it lost the cut at
 * MAX_SOCCER_LEAGUES, its odds call was rejected, the bookmakers list was
 * rejected and we fell back to US books that don't price it, its games are
 * outside the board's window, or no book has posted a market. This table
 * separates them — per league it shows the HTTP status, which books and which
 * markets actually came back, and how many games survive each filter.
 *
 * It reuses the same cached upstream responses the board renders from, so
 * loading it costs no extra API credits — and equally, it shows what's in the
 * cache, which can be up to the soccer revalidate window old.
 */
export async function SoccerFeedCard() {
  const feed = await getSoccerFeedDiagnostics();
  if (!feed.configured) return null;

  const totalInWindow = feed.selected.reduce((sum, l) => sum + l.inWindow, 0);
  const anyFallback = feed.selected.some((l) => l.fetch?.usedFallback);

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold">
          <Globe className="h-4 w-4 text-accent" /> Soccer feed
        </p>
        <span className="rounded-full bg-surface-raised px-2.5 py-1 text-xs font-medium text-muted">
          {feed.selected.length} / {feed.maxLeagues} leagues · {totalInWindow} games in window
        </span>
      </div>

      <p className="mt-1 text-xs text-muted">
        Asking <span className="font-mono">{feed.bookmakers.join(", ")}</span>, cached{" "}
        {feed.cacheHours}h. Set <span className="font-mono">ODDS_BOOKMAKERS</span> (up to 10,
        comma-separated) to widen it — more books bill the same as one region, and European books
        are the ones that price European football.
      </p>

      <p className="mt-1 text-xs text-muted">
        The competitions on the board, in the order they were picked. &ldquo;Window&rdquo; is what
        Today&apos;s lines shows, &ldquo;priced&rdquo; counts games a book posted odds for, and
        &ldquo;full&rdquo; those with a handicap and a goal line rather than just the 1X2. Read
        from the cached responses the board itself uses, so it can lag by up to the soccer
        refresh window.
      </p>

      {anyFallback && (
        <p className="mt-3 rounded-lg border border-gold/40 bg-gold/10 p-3 text-xs text-foreground">
          At least one league fell back to <code>regions=us</code>, meaning the preferred
          bookmakers list was rejected. US books carry far less European football and fewer
          soccer markets — this alone can explain missing competitions and missing
          handicaps/totals.
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="pb-2 font-medium">Competition</th>
              <th className="pb-2 text-right font-medium">HTTP</th>
              <th className="pb-2 text-right font-medium">Raw</th>
              <th className="pb-2 text-right font-medium">Window</th>
              <th className="pb-2 text-right font-medium">Priced</th>
              <th className="pb-2 text-right font-medium">Full</th>
              <th className="pb-2 font-medium">Books / markets returned</th>
            </tr>
          </thead>
          <tbody>
            {feed.selected.map((league) => (
              <tr key={league.sportKey} className="border-b border-border/60 align-top last:border-0">
                <td className="py-2 pr-3">
                  <span className="font-medium">{league.league}</span>{" "}
                  <span className="text-xs text-muted">{league.country}</span>
                  <span className="block font-mono text-[0.7rem] text-muted">{league.sportKey}</span>
                </td>
                <td className="py-2 text-right tabular-nums">
                  {league.fetch ? league.fetch.status : "—"}
                  {league.fetch?.usedFallback && (
                    <span className="block text-[0.65rem] text-gold">us fallback</span>
                  )}
                </td>
                <td className="py-2 text-right tabular-nums">{league.fetch?.rawEvents ?? "—"}</td>
                <td className="py-2 text-right tabular-nums">{league.inWindow}</td>
                <td className="py-2 text-right tabular-nums">{league.priced}</td>
                <td className="py-2 text-right tabular-nums">{league.withSpreadAndTotal}</td>
                <td className="py-2 pl-3 font-mono text-[0.7rem] text-muted">
                  {league.fetch && league.fetch.books.length > 0
                    ? `${league.fetch.books.join(", ")} · ${league.fetch.markets.join(", ") || "no markets"}`
                    : "nothing returned"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {feed.selected.length === 0 && (
        <p className="mt-3 text-sm text-muted">
          No soccer competitions came back as in season. Either the plan lists none right now, or
          the /sports call failed — check the Integrations card above for the key.
        </p>
      )}

      {feed.skipped.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-medium text-muted">
            {feed.skipped.length} active competition{feed.skipped.length === 1 ? "" : "s"} not
            carried — raise MAX_SOCCER_LEAGUES to include more
          </summary>
          <p className="mt-2 font-mono text-[0.7rem] leading-relaxed text-muted">
            {feed.skipped.join(", ")}
          </p>
        </details>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer text-xs font-medium text-muted">
          Copy as JSON (for support / debugging — contains no key)
        </summary>
        <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-surface-raised p-3 font-mono text-[0.7rem] leading-relaxed">
          {JSON.stringify(feed, null, 2)}
        </pre>
      </details>
    </div>
  );
}
