import type { PickResult } from "@prisma/client";

export type PickShareInfo = { text: string; url: string; imageUrl: string; downloadName: string };

// Build the share text + links for a pick's share button. A still-locked premium
// pick gets a teaser message that reveals nothing about the play; the pick-card
// image route enforces the same, so nothing leaks either way.
export function pickShareInfo(opts: {
  baseUrl: string;
  handle: string;
  displayName: string;
  pick: { id: string; selection: string; matchup: string; result: PickResult };
  locked: boolean;
}): PickShareInfo {
  const { baseUrl, handle, displayName, pick, locked } = opts;
  const decided = pick.result !== "PENDING";
  const text = locked
    ? `New premium pick is live from ${displayName} on Blitz.tips — subscribe to tail it before it starts.`
    : `${displayName}: ${pick.selection} — ${pick.matchup}. ${decided ? "Tracked & graded" : "Posted before kickoff"} on Blitz.tips.`;

  return {
    text,
    url: `${baseUrl}/handicappers/${handle}`,
    imageUrl: `${baseUrl}/api/share/pick/${pick.id}`,
    downloadName: `${handle}-${pick.id}.png`,
  };
}
