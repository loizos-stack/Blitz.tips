/**
 * The posting rotation's slots, split out from x-rotation.ts so the admin panel
 * can name them.
 *
 * x-rotation.ts is server-only — it reads the database to compose a post — but
 * the list of slots and what to call them is just vocabulary, and the queue UI
 * needs it to label rows and offer a preview button per slot.
 */

export const X_SLOTS = ["board", "gold", "leaderboard", "winner", "recruit"] as const;
export type XSlot = (typeof X_SLOTS)[number];

export const SLOT_LABELS: Record<XSlot, string> = {
  board: "Today's board",
  gold: "Gold capper",
  leaderboard: "Leaderboard",
  winner: "A pick that landed",
  recruit: "For handicappers",
};

/** A slot stored on a queued row, which is a plain string in the database. */
export function slotLabel(slot: string): string {
  return SLOT_LABELS[slot as XSlot] ?? slot;
}
