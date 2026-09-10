/**
 * Detecting correlated movement across one player's props.
 *
 * WHAT THE SIGNAL IS. One prop moving is noise: a trader's opinion, a stale
 * quote, a book squaring its own position. Several of the SAME PLAYER'S props
 * moving inside a few minutes, at more than one independent book, is
 * information — and it is nearly always information about that player. Points,
 * rebounds and assists all sliding at once is a minutes restriction. A
 * pitcher's strikeouts, outs and earned runs all moving is a scratch or a
 * weather call. Both directions count: a shortening line and a drifting one are
 * the same news seen from opposite sides.
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

/** Every sample seen for one player's one line at one book. */
export interface LineHistory {
  player: string;
  marketKey: string;
  selection: string;
  bookmaker: string;
  /** Oldest first. */
  samples: PriceSample[];
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
  /** Signed, in probability points. Zero for a line move — see below. */
  probDelta: number;
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
  /** Only movement inside this many minutes is considered together. */
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
 * Turn per-line histories into the moves that happened inside the window.
 *
 * Compares the oldest and newest sample within the window rather than
 * consecutive pairs: a line that ticks down four times in eight minutes is one
 * move of the size that matters, not four small ones that each miss the
 * threshold.
 */
export function detectMoves(histories: LineHistory[], opts: ClusterOpts, now: Date = new Date()): Move[] {
  const cutoff = now.getTime() - opts.clusterMinutes * 60_000;
  const moves: Move[] = [];

  for (const history of histories) {
    const inWindow = history.samples
      .filter((s) => s.at.getTime() >= cutoff && validAmerican(s.price))
      .sort((a, b) => a.at.getTime() - b.at.getTime());
    // Nothing to compare against: one sighting is a price, not a change.
    if (inWindow.length < 2) continue;

    const first = inWindow[0]!;
    const last = inWindow[inWindow.length - 1]!;
    const base = {
      player: history.player,
      marketKey: history.marketKey,
      selection: history.selection,
      bookmaker: history.bookmaker,
      at: last.at,
    };

    const lineMoved =
      typeof first.point === "number" && typeof last.point === "number" && first.point !== last.point;

    if (lineMoved) {
      if (!opts.countLineMoves) continue;
      // probDelta stays 0 on purpose. Prices at two different lines are not
      // comparable — -115 on 25.5 and -115 on 24.5 are different bets — so
      // reporting a probability change here would be inventing a number.
      const direction: "UP" | "DOWN" = last.point! > first.point! ? "UP" : "DOWN";
      moves.push({
        ...base,
        kind: "line",
        from: first.point!,
        to: last.point!,
        probDelta: 0,
        direction,
        // A line moving up is the market expecting more of the stat, which is
        // the player marked up regardless of which side is quoted.
        playerDirection: direction,
      });
      continue;
    }

    const probDelta = probabilityDelta(first.price, last.price);
    if (Math.abs(probDelta) < opts.minProbDelta) continue;
    const direction: "UP" | "DOWN" = probDelta > 0 ? "UP" : "DOWN";
    moves.push({
      ...base,
      kind: "price",
      from: first.price,
      to: last.price,
      probDelta,
      direction,
      playerDirection: normalizeForPlayer(history.selection, direction),
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
export function detectPlayerSignals(
  histories: LineHistory[],
  opts: ClusterOpts,
  now: Date = new Date()
): PlayerSignal[] {
  return clusterByPlayer(detectMoves(histories, opts, now), opts);
}

/**
 * Whether a freshly detected cluster is worth surfacing, given the last one
 * raised for the same player.
 *
 * Without this the same slide is re-reported every cycle for as long as it sits
 * inside the window, and a panel that repeats itself is a panel nobody reads.
 * A cluster that has since spread to more of the player's markets IS new — that
 * is the story developing rather than repeating.
 */
export function isNewInformation(
  signal: PlayerSignal,
  previous: { markets: string[]; detectedAt: Date } | null,
  clusterMinutes: number
): boolean {
  if (!previous) return true;
  const stale = signal.at.getTime() - previous.detectedAt.getTime() >= clusterMinutes * 60_000;
  if (stale) return true;
  return signal.markets.some((m) => !previous.markets.includes(m));
}

/** "-115 → +105" for display. */
export function formatMove(move: Move): string {
  const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  if (move.kind === "line") return `line ${move.from} → ${move.to}`;
  return `${sign(move.from)} → ${sign(move.to)}`;
}
