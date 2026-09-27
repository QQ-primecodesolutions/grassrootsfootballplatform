import type { CompetitionRules } from "@/lib/rules";

/** The columns every league table has, whether computed by us or published by an organiser. */
export type TableRowLike = {
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  /** Points adjustment included in `points` (0 when absent). */
  adjustment?: number;
};

export type InvariantResult = { ok: boolean; errors: string[] };

/**
 * Sanity checks that hold for any correct league table:
 * total wins = total losses, total draws is even, total GF = total GA, ΣGD = 0,
 * and per row P = W + D + L and GD = GF − GA. With `rules`, also
 * Pts − adjustment = W·win + D·draw + L·loss.
 */
export function checkTableInvariants(rows: TableRowLike[], rules?: CompetitionRules): InvariantResult {
  const errors: string[] = [];
  const sum = (f: (r: TableRowLike) => number) => rows.reduce((acc, r) => acc + f(r), 0);

  const wins = sum((r) => r.won);
  const losses = sum((r) => r.lost);
  const draws = sum((r) => r.drawn);
  const goalsFor = sum((r) => r.goalsFor);
  const goalsAgainst = sum((r) => r.goalsAgainst);
  const goalDifference = sum((r) => r.goalDifference);

  if (wins !== losses) errors.push(`Total wins (${wins}) ≠ total losses (${losses})`);
  if (draws % 2 !== 0) errors.push(`Total draws (${draws}) is odd`);
  if (goalsFor !== goalsAgainst) errors.push(`Total goals for (${goalsFor}) ≠ total goals against (${goalsAgainst})`);
  if (goalDifference !== 0) errors.push(`Sum of goal difference is ${goalDifference}, expected 0`);

  for (const r of rows) {
    if (r.played !== r.won + r.drawn + r.lost) {
      errors.push(`${r.name}: GP ${r.played} ≠ W + D + L (${r.won + r.drawn + r.lost})`);
    }
    if (r.goalDifference !== r.goalsFor - r.goalsAgainst) {
      errors.push(`${r.name}: GD ${r.goalDifference} ≠ GF − GA (${r.goalsFor - r.goalsAgainst})`);
    }
    if (rules) {
      const expected =
        r.won * rules.points.win + r.drawn * rules.points.draw + r.lost * rules.points.loss + (r.adjustment ?? 0);
      if (r.points !== expected) errors.push(`${r.name}: Pts ${r.points} ≠ ${expected} from W/D/L and adjustments`);
    }
  }

  return { ok: errors.length === 0, errors };
}
