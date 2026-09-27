import { normalizeTeamName } from "@/lib/fixtures-paste/normalize";
import type { TableRowLike } from "./invariants";

/** A row of a table as an organiser published it (e.g. on a matchday graphic). */
export type PublishedRow = TableRowLike & { position: number };

export type TableDifference = {
  team: string;
  column: "row" | "position" | "played" | "won" | "drawn" | "lost" | "goalsFor" | "goalsAgainst" | "goalDifference" | "points";
  expected: number | string | null;
  actual: number | string | null;
};

const COLUMNS = [
  "position",
  "played",
  "won",
  "drawn",
  "lost",
  "goalsFor",
  "goalsAgainst",
  "goalDifference",
  "points",
] as const;

/**
 * List every cell where our computed table differs from a published one.
 * Rows are matched by normalised team name ("Passion FC" = "Passion").
 * An empty array means the tables agree exactly.
 */
export function compareWithPublishedTable(
  computed: PublishedRow[],
  published: PublishedRow[],
): TableDifference[] {
  const diffs: TableDifference[] = [];
  const byName = new Map(computed.map((r) => [normalizeTeamName(r.name), r]));
  const seen = new Set<string>();

  for (const pub of published) {
    const key = normalizeTeamName(pub.name);
    seen.add(key);
    const row = byName.get(key);
    if (!row) {
      diffs.push({ team: pub.name, column: "row", expected: "present", actual: "missing" });
      continue;
    }
    for (const column of COLUMNS) {
      if (row[column] !== pub[column]) {
        diffs.push({ team: pub.name, column, expected: pub[column], actual: row[column] });
      }
    }
  }
  for (const row of computed) {
    if (!seen.has(normalizeTeamName(row.name))) {
      diffs.push({ team: row.name, column: "row", expected: "absent", actual: "present" });
    }
  }
  return diffs;
}
