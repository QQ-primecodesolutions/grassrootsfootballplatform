import { normalizeTeamName } from "./normalize";

/**
 * Match pasted team names against the teams entered in ONE competition, using
 * their official names and aliases. Scoping to the competition means "Junior Stars"
 * in Stream B can never be matched to "Tseki Junior Stars FC" in Stream A.
 */

export type Candidate = { entryId: string; name: string; aliases: string[] };

export type NameMatch =
  | { status: "matched"; entryId: string }
  | { status: "ambiguous"; options: string[] }
  | { status: "unmatched"; suggestions: string[] };

function tokens(s: string): Set<string> {
  return new Set(normalizeTeamName(s).split(" ").filter(Boolean));
}

/** Share of tokens in common (Jaccard). Cheap and good enough for suggestions. */
function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  return common / (ta.size + tb.size - common);
}

export function matchTeamName(text: string, candidates: Candidate[]): NameMatch {
  const key = normalizeTeamName(text);
  const hits = candidates.filter(
    (c) => normalizeTeamName(c.name) === key || c.aliases.some((a) => normalizeTeamName(a) === key),
  );
  if (hits.length === 1) return { status: "matched", entryId: hits[0]!.entryId };
  if (hits.length > 1) return { status: "ambiguous", options: hits.map((h) => h.entryId) };

  const suggestions = candidates
    .map((c) => ({ id: c.entryId, score: Math.max(similarity(text, c.name), ...c.aliases.map((a) => similarity(text, a))) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.id);
  return { status: "unmatched", suggestions };
}
