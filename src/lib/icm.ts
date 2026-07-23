// Exact Independent Chip Model (Harville) payouts.
//
// Given each player's "stack" and a prize ladder (in cents), returns each
// player's ICM equity in whole cents, reconciled so the payouts sum exactly to
// the prize total. Uses a subset DP over which players have already finished:
//   P(S) = probability the players in S took the first |S| finishing places.
// This is exact but O(2^n · n) in memory/time, so the field must stay small
// (contest payouts cap at ~20 places, which is well within range).

const MAX_FIELD = 20;

export function icmEquityCents(stacks: number[], prizesCents: number[]): number[] {
  const n = stacks.length;
  if (n === 0) return [];
  if (n > MAX_FIELD) {
    throw new Error(`ICM field too large (${n}); cap is ${MAX_FIELD}`);
  }

  const K = Math.min(prizesCents.length, n); // number of paid places
  const totalAll = stacks.reduce((a, b) => a + b, 0);
  const size = 1 << n;

  const prob = new Float64Array(size); // P(S): S occupies the first |S| places
  const stackSum = new Float64Array(size);
  const placed = new Int8Array(size); // popcount(S)
  const equity = new Float64Array(n);

  // Precompute stack sums and place counts for every subset (incrementally).
  for (let s = 1; s < size; s++) {
    const low = s & -s;
    const j = 31 - Math.clz32(low);
    stackSum[s] = stackSum[s ^ low] + stacks[j];
    placed[s] = placed[s ^ low] + 1;
  }

  prob[0] = 1;
  for (let s = 0; s < size; s++) {
    const p = prob[s];
    if (p === 0) continue;
    const k = placed[s];
    if (k >= K) continue; // all paid places already filled on this branch
    const remaining = totalAll - stackSum[s];
    if (remaining <= 0) continue;
    const prize = prizesCents[k]; // prize for finishing place k+1
    for (let j = 0; j < n; j++) {
      const bit = 1 << j;
      if (s & bit) continue;
      const contrib = (p * stacks[j]) / remaining; // P(j finishes next after S)
      equity[j] += contrib * prize;
      prob[s | bit] += contrib;
    }
  }

  // Round to cents and reconcile the remainder so the total is exact.
  const target = prizesCents.slice(0, K).reduce((a, b) => a + b, 0);
  const out = Array.from(equity, (e) => Math.round(e));
  let diff = target - out.reduce((a, b) => a + b, 0);
  const byEquity = out.map((_, i) => i).sort((a, b) => equity[b] - equity[a]);
  for (let idx = 0; diff !== 0 && idx < byEquity.length; idx++) {
    const step = diff > 0 ? 1 : -1;
    out[byEquity[idx]] += step;
    diff -= step;
  }
  return out;
}

export { MAX_FIELD as ICM_MAX_FIELD };
