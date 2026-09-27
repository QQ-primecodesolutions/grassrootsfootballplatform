/**
 * Parse fixtures pasted from WhatsApp, one per line:
 *   "Passion FC vs Samba Boys"
 *   "1. 14:00 Tseki Jnr Stars v Remember Matoota"
 *   "⚽ Lere La Tshepe versus Tseki Galaxy 2pm"
 * The separator is "vs", "vs.", "v" or "versus" (any case). A hyphen is NOT a
 * separator: it clashes with scores and hyphenated names. Lines without a
 * separator (headings like "Round 8 fixtures") are ignored.
 */

export type ParsedLine = {
  lineNo: number;
  raw: string;
  home: string;
  away: string;
  /** "HH:MM" (24h) when a time was found on the line. */
  time: string | null;
};

export type ParseResult = { fixtures: ParsedLine[]; ignored: { lineNo: number; raw: string }[] };

const SEPARATOR = /\s+(?:vs\.?|v|versus)\s+/i;
// Numbering, bullets and emoji at the start of a line: "1.", "2)", "-", "•", "*", "⚽".
const PREFIX = /^(?:\s*(?:\d{1,2}[.)]|[-•*–—]|[\p{Extended_Pictographic}️]))+\s*/u;
// 14:00 · 14h00 · 14.00 · 2pm · 2:30 pm · 2 pm
const TIME = /(?:^|\s)(?:(\d{1,2})[:h.](\d{2})\s*(am|pm)?|(\d{1,2})\s*(am|pm))(?=\s|$)/i;

function to24h(h: number, m: number, ampm: string | undefined): string | null {
  let hour = h;
  if (ampm) {
    const pm = ampm.toLowerCase() === "pm";
    if (hour < 1 || hour > 12) return null;
    if (pm && hour !== 12) hour += 12;
    if (!pm && hour === 12) hour = 0;
  }
  if (hour > 23 || m > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function extractTime(text: string): { text: string; time: string | null } {
  const m = TIME.exec(text);
  if (!m) return { text, time: null };
  const time = m[1] !== undefined ? to24h(Number(m[1]), Number(m[2]), m[3]) : to24h(Number(m[4]), 0, m[5]);
  if (!time) return { text, time: null };
  return { text: (text.slice(0, m.index) + " " + text.slice(m.index + m[0].length)).trim(), time };
}

const clean = (s: string) => s.replace(/[\p{Extended_Pictographic}️]/gu, "").replace(/\s+/g, " ").trim();

export function parseFixtureText(input: string): ParseResult {
  const fixtures: ParsedLine[] = [];
  const ignored: { lineNo: number; raw: string }[] = [];
  input.split(/\r?\n/).forEach((raw, i) => {
    const lineNo = i + 1;
    if (!raw.trim()) return;
    const { text, time } = extractTime(raw.replace(PREFIX, ""));
    const parts = text.split(SEPARATOR);
    if (parts.length !== 2) {
      ignored.push({ lineNo, raw });
      return;
    }
    const home = clean(parts[0]!);
    const away = clean(parts[1]!);
    if (!home || !away) {
      ignored.push({ lineNo, raw });
      return;
    }
    fixtures.push({ lineNo, raw, home, away, time });
  });
  return { fixtures, ignored };
}
