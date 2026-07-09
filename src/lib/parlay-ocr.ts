import "server-only";

export interface OcrLeg {
  matchup: string;
  selection: string;
  odds: number;
}

export type OcrProvider = "claude" | "tesseract";

/** Claude (structured, paid) when a key is set; otherwise free on-server Tesseract. */
export function ocrProvider(): OcrProvider {
  return process.env.ANTHROPIC_API_KEY ? "claude" : "tesseract";
}

/** OCR is always available now (free Tesseract fallback). */
export function isOcrConfigured(): boolean {
  return true;
}

const PROMPT = `You are reading a photo or screenshot of a sports betting parlay slip.
Extract each individual leg of the parlay. Respond with ONLY a JSON array — no prose, no code fences.
Each array item must be an object with exactly these keys:
- "matchup": the teams/event, e.g. "Lakers vs Celtics" or "Chiefs @ Bills"
- "selection": the specific bet for that leg, e.g. "Lakers -3.5", "Over 220.5", "Chiefs ML"
- "odds": the leg's American odds as an integer, e.g. -110 or 165. If a leg's odds aren't shown, use -110.
Do NOT include the parlay's total/combined odds as a leg. If you can't read the slip, return [].`;

function parseDataUrl(dataUrl: string): { mediaType: string; data: string } {
  const match = /^data:(image\/(?:png|jpe?g|webp|gif));base64,(.+)$/i.exec(dataUrl);
  if (!match) throw new Error("Please upload a PNG, JPG, or WebP image.");
  return { mediaType: match[1], data: match[2] };
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

function toLeg(matchup: unknown, selection: unknown, oddsRaw: unknown): OcrLeg | null {
  const m = String(matchup ?? "").trim();
  const s = String(selection ?? "").trim();
  let odds = Math.round(Number(oddsRaw));
  if (!Number.isFinite(odds) || odds === 0) odds = -110;
  if (!s) return null;
  return { matchup: m || s, selection: s, odds };
}

// ---- Claude vision (paid, structured) ----
async function readWithClaude(dataUrl: string): Promise<OcrLeg[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const { mediaType, data } = parseDataUrl(dataUrl);
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

  if (!res.ok) throw new Error(`Couldn't read the image (vision service returned ${res.status}).`);
  const body = await res.json().catch(() => null);
  const text: string = body?.content?.[0]?.text ?? "";
  const parsed = extractJsonArray(text);
  if (!Array.isArray(parsed)) throw new Error("Couldn't find any parlay legs in that image.");

  const legs: OcrLeg[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const leg = toLeg(rec.matchup, rec.selection, rec.odds);
    if (leg) legs.push(leg);
  }
  return legs;
}

// ---- Tesseract (free, on-server text OCR + heuristic parsing) ----

// American odds: a sign followed by 3–5 digits, not a decimal (so it won't grab
// a spread like -3.5). Matches +150, -110, +2500.
const ODDS_RE = /([+-]\d{3,5})(?!\.\d)/;
const MATCHUP_RE = /\bvs\.?\b|\bat\b|@/i;
// Header / total / summary lines that aren't legs (kept narrow so real bets
// like "Total Points Over 45.5" aren't dropped).
const NOISE_RE = /\b(parlay|payout|to win|to return|wager|stake|bet ?slip|same game|cash ?out|\d+\s*legs?)\b/i;

/**
 * Best-effort parse of raw OCR text into parlay legs. Walks the lines keeping
 * the most recent candidate selection and matchup; when an odds token appears
 * it emits a leg. Handicappers review the result before posting.
 */
function parseLegsFromText(text: string): OcrLeg[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const legs: OcrLeg[] = [];
  const seen = new Set<string>();
  let lastSelection = "";
  let lastMatchup = "";

  for (const line of lines) {
    if (NOISE_RE.test(line)) continue;

    const m = ODDS_RE.exec(line);
    if (m) {
      const odds = Number(m[1]);
      const inline = line.replace(m[1], "").replace(/[|·•]+/g, " ").replace(/\s+/g, " ").trim();
      const selection = inline || lastSelection || lastMatchup;
      if (!selection) continue;
      const matchup = lastMatchup || selection;
      const key = `${selection}|${odds}`;
      if (!seen.has(key)) {
        seen.add(key);
        const leg = toLeg(matchup, selection, odds);
        if (leg) legs.push(leg);
      }
      lastSelection = "";
      lastMatchup = "";
      if (legs.length >= 12) break;
      continue;
    }

    if (MATCHUP_RE.test(line)) lastMatchup = line;
    else lastSelection = line;
  }

  return legs;
}

async function readWithTesseract(dataUrl: string): Promise<OcrLeg[]> {
  parseDataUrl(dataUrl); // validate format early
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const {
      data: { text },
    } = await worker.recognize(dataUrl);
    const legs = parseLegsFromText(text);
    if (legs.length === 0) {
      throw new Error("Couldn't pick out any legs — try a clearer image or add them manually.");
    }
    return legs;
  } finally {
    await worker.terminate();
  }
}

/**
 * Read parlay legs from a base64 data-URL image. Uses Anthropic vision when
 * ANTHROPIC_API_KEY is set (best accuracy), otherwise the free on-server
 * Tesseract OCR with heuristic parsing. Throws a user-friendly message.
 */
export async function readParlayFromImage(dataUrl: string): Promise<OcrLeg[]> {
  return ocrProvider() === "claude" ? readWithClaude(dataUrl) : readWithTesseract(dataUrl);
}
