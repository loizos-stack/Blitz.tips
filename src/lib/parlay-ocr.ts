import "server-only";

export interface OcrLeg {
  matchup: string;
  selection: string;
  odds: number;
}

const PROMPT = `You are reading a photo or screenshot of a sports betting parlay slip.
Extract each individual leg of the parlay. Respond with ONLY a JSON array — no prose, no code fences.
Each array item must be an object with exactly these keys:
- "matchup": the teams/event, e.g. "Lakers vs Celtics" or "Chiefs @ Bills"
- "selection": the specific bet for that leg, e.g. "Lakers -3.5", "Over 220.5", "Chiefs ML"
- "odds": the leg's American odds as an integer, e.g. -110 or 165. If a leg's odds aren't shown, use -110.
Do NOT include the parlay's total/combined odds as a leg. If you can't read the slip, return [].`;

/** True when the server is configured to read bet-slip images. */
export function isOcrConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function extractJsonArray(text: string): unknown {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Read parlay legs from a base64 data-URL image via Anthropic's vision API.
 * Requires ANTHROPIC_API_KEY. Throws a user-friendly message on failure.
 */
export async function readParlayFromImage(dataUrl: string): Promise<OcrLeg[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Bet-slip reading isn't configured on this server yet.");

  const match = /^data:(image\/(?:png|jpe?g|webp|gif));base64,(.+)$/i.exec(dataUrl);
  if (!match) throw new Error("Please upload a PNG, JPG, or WebP image.");
  const [, mediaType, data] = match;

  const model = process.env.OCR_MODEL ?? "claude-haiku-4-5-20251001";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Couldn't read the image (vision service returned ${res.status}).`);
  }

  const body = await res.json().catch(() => null);
  const text: string = body?.content?.[0]?.text ?? "";
  const parsed = extractJsonArray(text);
  if (!Array.isArray(parsed)) throw new Error("Couldn't find any parlay legs in that image.");

  const legs: OcrLeg[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const matchup = String((item as Record<string, unknown>).matchup ?? "").trim();
    const selection = String((item as Record<string, unknown>).selection ?? "").trim();
    let odds = Math.round(Number((item as Record<string, unknown>).odds));
    if (!Number.isFinite(odds) || odds === 0) odds = -110;
    if (matchup && selection) legs.push({ matchup, selection, odds });
  }
  return legs;
}
