import { Globe } from "lucide-react";
import { getSoccerFeedDiagnostics } from "@/lib/odds-api";

/**
 * What the soccer board resolved to, right now.
 *
 * "Why isn't the Europa League showing?" has half a dozen possible answers that
 * all look the same from the outside — the competition isn't active on the plan,
 * it lost the cut at MAX_SOCCER_LEAGUES, its odds call failed, its games are
 * outside the board's window, or the books haven't priced it. This table says
 * which. It reuses the same cached upstream responses the board does, so
 * loading it costs no extra API credits.
 */
export async function SoccerFeedCard() {
  const feed = await getSoccerFeedDiagnostics();
  if (!feed.configured) return null;

  const totalInWindow = feed.selected.reduce((sum, l) => sum + l.inWindow, 0);

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
        The competitions currently on the board, in the order they were picked. &ldquo;In
        window&rdquo; is what Today&apos;s lines will show; &ldquo;priced&rdquo; counts games a
        book has posted odds for, and &ldquo;full lines&rdquo; those with a handicap and a goal
        line rather than just the 1X2.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="pb-2 font-medium">Competition</th>
              <th className="pb-2 text-right font-medium">Games</th>
              <th className="pb-2 text-right font-medium">In window</th>
              <th className="pb-2 text-right font-medium">Priced</th>
              <th className="pb-2 text-right font-medium">Full lines</th>
            </tr>
          </thead>
          <tbody>
            {feed.selected.map((league) => (
              <tr key={league.sportKey} className="border-b border-border/60 last:border-0">
                <td className="py-2">
                  <span className="font-medium">{league.league}</span>{" "}
                  <span className="text-xs text-muted">{league.country}</span>
                  <span className="block font-mono text-[0.7rem] text-muted">{league.sportKey}</span>
                </td>
                <td className="py-2 text-right tabular-nums">{league.events}</td>
                <td className="py-2 text-right tabular-nums">{league.inWindow}</td>
                <td className="py-2 text-right tabular-nums">{league.priced}</td>
                <td className="py-2 text-right tabular-nums">{league.withSpreadAndTotal}</td>
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
    </div>
  );
}
