/**
 * Normalise a team name or alias for matching pasted text:
 * lower-case, strip diacritics and punctuation, collapse whitespace, and drop a
 * trailing "FC" / "F.C." so "Passion FC" and "Passion" compare equal.
 * Anything smarter ("Jnr" = "Junior") belongs in explicit TeamAlias rows.
 */
export function normalizeTeamName(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/(?:^|\s)f\s?c$/, "")
    .trim();
}

/** URL slug from a display name: "Tseki Junior Stars FC" → "tseki-junior-stars-fc". */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
