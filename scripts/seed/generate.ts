/** Deterministic helpers for generating fictional demo data. */

/** mulberry32: small, fast, seedable PRNG. Same seed → same sequence. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Grassroots-ish goal distribution: mostly 0–2, occasionally more. */
export function randomGoals(rng: () => number): number {
  const r = rng();
  if (r < 0.25) return 0;
  if (r < 0.55) return 1;
  if (r < 0.8) return 2;
  if (r < 0.93) return 3;
  return 4;
}

/**
 * Round-robin pairings via the circle method. Returns one array of [home, away]
 * index pairs per round. With `double`, the second half repeats the first with
 * home and away swapped. Requires an even number of teams.
 */
export function roundRobin(teamCount: number, opts: { double?: boolean } = {}): Array<Array<[number, number]>> {
  if (teamCount < 2 || teamCount % 2 !== 0) throw new Error("roundRobin needs an even number of teams ≥ 2");
  const ids = Array.from({ length: teamCount }, (_, i) => i);
  const rounds: Array<Array<[number, number]>> = [];
  for (let r = 0; r < teamCount - 1; r++) {
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < teamCount / 2; i++) {
      const a = ids[i]!;
      const b = ids[teamCount - 1 - i]!;
      // Alternate home advantage so no team is always home.
      pairs.push((r + i) % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    // Keep ids[0] fixed, rotate the rest clockwise.
    ids.splice(1, 0, ids.pop()!);
  }
  if (opts.double) {
    const second = rounds.map((pairs) => pairs.map(([h, a]) => [a, h] as [number, number]));
    rounds.push(...second);
  }
  return rounds;
}

/** Add whole days to a YYYY-MM-DD date string. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
