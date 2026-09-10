/**
 * Detecting correlated movement across one player's props.
 *
 * WHAT THE SIGNAL IS. One prop moving is noise: a trader's opinion, a stale
 * quote, a book squaring its own position. Several of the SAME PLAYER'S props
 * having moved off where they opened, at more than one independent book, is
 * information — and it is nearly always information about that player. Points,
 * rebounds and assists all sliding together is a minutes restriction. A
 * pitcher's strikeouts, outs and earned runs all moving is a scratch or a
 * weather call. Both directions count: a shortening line and a drifting one are
 * the same news seen from opposite sides.
 *
 * MEASURED FROM THE OPEN. Every move here is the distance from the first price
 * this watcher saw for that line to the price now — not the change across some
 * recent window. A line that has bled steadily all afternoon shows nothing
 * through a ten-minute lens that happens to land on a quiet stretch, while the
 * cumulative move is the one that says how far the market has actually
 * travelled. The cost is that a move, once made, stands: the re-raise rule at
 * the bottom of this file is what stops that becoming the same alert forever.
 *
 * WHY THE MATH IS IN PROBABILITY. American odds are not a linear scale. The
 * same twenty-point move is 4.14 probability points at -110, 2.38 at +200 and
 * 0.17 at +1000, so a threshold on the raw number fires constantly on longshots
 * and almost never on the short prices where the money actually is. Every
 * threshold here is in implied probability, which is comparable across prices.
 *
 * This file is pure: no database, no network, no clock of its own. That is what
 * makes the awkward cases — a line that moved rather than a price, an Under
 * whose rise means the player was marked DOWN — testable at the boundary.
 */

/** Implied probability of an American price, as a percentage. Vig included. */
export function impliedProbability(american: number): number {
  return american > 0 ? (100 / (american + 100)) * 100 : (-american / (-american + 100)) * 100;
}

/** Signed change in implied probability, in percentage points. */
export function probabilityDelta(from: number, to: number): number {
  return Number((impliedProbability(to) - impliedProbability(from)).toFixed(2));
}

/**
 * American odds are undefined between -100 and +100, so anything in that band
 * is a malformed or scrambled price rather than a long shot. Structural check,
 * not a plausibility one.
 */
export function validAmerican(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && Math.abs(n) >= 100;
}

export interface PriceSample {
  price: number;
  /** The line, when the market has one. Null for yes/no markets. */
  point: number | null;
  at: Date;
}

/**
 * One player's line at one book: where it opened, and where it is now.
 *
 * Movement is measured from the OPENING price rather than from the oldest
 * sample in a recent window. The difference matters: a line that has bled ten
 * probability points since it was posted looks like nothing at all through a
 * ten-minute window that happens to catch a quiet stretch of it, and the
 * cumulative move is the one that says how far the market has travelled.
 *
 * `open` is the first price THIS WATCHER saw, which is not necessarily the
 * book's true opener — a tool switched on at noon cannot know where a line
 * opened at nine. `open.at` is carried so the panel can say when the baseline
 * was taken instead of implying more than it knows.
 */
export interface LineState {
  player: string;
  marketKey: string;
  selection: string;
  bookmaker: string;
  open: PriceSample;
  latest: PriceSample;
}

export interface Move {
  player: string;
  marketKey: string;
  selection: string;
  bookmaker: string;
  /** A price change at a fixed line, or the line itself moving. */
  kind: "price" | "line";
  /** Price for a price move; the line for a line move. */
  from: number;
  to: number;
  /** Signed, in probability points, measured from the open. Zero for a line move. */
  probDelta: number;
  /** When the opening price was first seen, so "since open" has a length. */
  openedAt: Date;
  /** Which way this SELECTION went: UP means the market got more confident in it. */
  direction: "UP" | "DOWN";
  /**
   * Which way the PLAYER went, which is the opposite of the selection for an
   * Under. Points Over shortening and Points Under drifting are the same news;
   * without this normalisation a real injury reads as MIXED.
   */
  playerDirection: "UP" | "DOWN";
  at: Date;
}

export interface ClusterOpts {
  /**
   * How long a raised cluster stays quiet before it can be raised again. Not a
   * comparison window any more — movement is measured from the open — but the
   * floor that stops the same standing move being reported every cycle.
   */
  clusterMinutes: number;
  /** Distinct markets of one player that must have moved. */
  minProps: number;
  /** Distinct books the movement must appear at. */
  minBooks: number;
  /** Minimum price move, in probability points. */
  minProbDelta: number;
  /** Whether the line moving, on its own, counts as a move. */
  countLineMoves: boolean;
}

export interface PlayerSignal {
  player: string;
  moves: Move[];
  /** Distinct market keys, sorted. */
  markets: string[];
  /** Distinct book keys, sorted. */
  books: string[];
  /** Where the player was marked, overall. MIXED when the moves disagree. */
  direction: "UP" | "DOWN" | "MIXED";
  /** Largest single price move in the cluster, in probability points. */
  topProbDelta: number;
  /** The newest move in the cluster. */
  at: Date;
}

/**
 * An Under getting more likely is the player being marked DOWN. Yes/No and
 * scorer markets read straight — "Anytime TD: Yes" shortening is a mark UP.
 */
function normalizeForPlayer(selection: string, direction: "UP" | "DOWN"): "UP" | "DOWN" {
  const isUnder = selection.trim().toLowerCase() === "under";
  if (!isUnder) return direction;
  return direction === "UP" ? "DOWN" : "UP";
}

/**
 * Turn line states into the moves that have happened since each one opened.
 *
 * No window filter: the comparison is open → now by definition, so a move that
 * began an hour ago and is still standing is still a move. What stops the same
 * standing move being reported forever is the re-raise rule below, not a
 * comparison that quietly forgets.
 */
export function detectMoves(lines: LineState[], opts: ClusterOpts): Move[] {
  const moves: Move[] = [];

  for (const line of lines) {
    const { open, latest } = line;
    if (!validAmerican(open.price) || !validAmerican(latest.price)) continue;

    const base = {
      player: line.player,
      marketKey: line.marketKey,
      selection: line.selection,
      bookmaker: line.bookmaker,
      openedAt: open.at,
      at: latest.at,
    };

    const lineMoved =
      typeof open.point === "number" && typeof latest.point === "number" && open.point !== latest.point;

    if (lineMoved) {
      if (!opts.countLineMoves) continue;
      // probDelta stays 0 on purpose. Prices at two different lines are not
      // comparable — -115 on 25.5 and -115 on 24.5 are different bets — so
      // reporting a probability change here would be inventing a number.
      const direction: "UP" | "DOWN" = latest.point! > open.point! ? "UP" : "DOWN";
      moves.push({
        ...base,
        kind: "line",
        from: open.point!,
        to: latest.point!,
        probDelta: 0,
        direction,
        // A line moving up is the market expecting more of the stat, which is
        // the player marked up regardless of which side is quoted.
        playerDirection: direction,
      });
      continue;
    }

    const probDelta = probabilityDelta(open.price, latest.price);
    if (Math.abs(probDelta) < opts.minProbDelta) continue;
    const direction: "UP" | "DOWN" = probDelta > 0 ? "UP" : "DOWN";
    moves.push({
      ...base,
      kind: "price",
      from: open.price,
      to: latest.price,
      probDelta,
      direction,
      playerDirection: normalizeForPlayer(line.selection, direction),
    });
  }

  return moves;
}

/**
 * Group moves into per-player clusters that clear both bars.
 *
 * Both bars, not either: several props at one book is that book repricing a
 * player, which happens all day and means little. The same movement at
 * independent books is the market agreeing, and that is the part that carries
 * information.
 */
export function clusterByPlayer(moves: Move[], opts: ClusterOpts): PlayerSignal[] {
  const byPlayer = new Map<string, Move[]>();
  for (const move of moves) {
    const list = byPlayer.get(move.player);
    if (list) list.push(move);
    else byPlayer.set(move.player, [move]);
  }

  const signals: PlayerSignal[] = [];
  for (const [player, playerMoves] of byPlayer) {
    const markets = [...new Set(playerMoves.map((m) => m.marketKey))].sort();
    const books = [...new Set(playerMoves.map((m) => m.bookmaker))].sort();
    if (markets.length < opts.minProps) continue;
    if (books.length < opts.minBooks) continue;

    const up = playerMoves.filter((m) => m.playerDirection === "UP").length;
    const down = playerMoves.length - up;
    const direction: PlayerSignal["direction"] = up === 0 ? "DOWN" : down === 0 ? "UP" : "MIXED";

    const topProbDelta = playerMoves.reduce(
      (max, m) => (Math.abs(m.probDelta) > Math.abs(max) ? m.probDelta : max),
      0
    );
    const at = playerMoves.reduce((latest, m) => (m.at > latest ? m.at : latest), playerMoves[0]!.at);

    signals.push({ player, moves: playerMoves, markets, books, direction, topProbDelta, at });
  }

  // Biggest first — a five-market cluster deserves the eye before a two.
  return signals.sort(
    (a, b) => b.markets.length - a.markets.length || Math.abs(b.topProbDelta) - Math.abs(a.topProbDelta)
  );
}

/** The whole detection, in one call. */
export function detectPlayerSignals(lines: LineState[], opts: ClusterOpts): PlayerSignal[] {
  return clusterByPlayer(detectMoves(lines, opts), opts);
}

/**
 * Whether a freshly detected cluster is worth surfacing, given the last one
 * raised for the same player.
 *
 * This carries far more weight now that movement is measured from the open. A
 * player whose props are eight points off their opening price is eight points
 * off them for the rest of the day, so a detector without this would re-report
 * the same fact every cycle until kickoff — and a panel that repeats itself is
 * a panel nobody reads.
 *
 * So a standing cluster is news exactly twice: when it appears, and when it
 * gets meaningfully worse. "Worse" is either wider — a market of that player's
 * that had not moved before has now joined in — or deeper, by at least another
 * whole threshold's worth of probability. Anything less is the same story.
 *
 * The cooldown is a hard floor beneath all of that: nothing is raised twice
 * inside it, however the numbers move.
 */
export function isNewInformation(
  signal: PlayerSignal,
  previous: { markets: string[]; topProbDelta: number; detectedAt: Date } | null,
  cooldownMinutes: number,
  minProbDelta: number
): boolean {
  if (!previous) return true;
  if (signal.at.getTime() - previous.detectedAt.getTime() < cooldownMinutes * 60_000) return false;

  const wider = signal.markets.some((m) => !previous.markets.includes(m));
  const deeper = Math.abs(signal.topProbDelta) >= Math.abs(previous.topProbDelta) + minProbDelta;
  return wider || deeper;
}

/** "-115 → +105" for display, always from the opening price. */
export function formatMove(move: Move): string {
  const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  if (move.kind === "line") return `line ${move.from} → ${move.to}`;
  return `${sign(move.from)} → ${sign(move.to)}`;
}
