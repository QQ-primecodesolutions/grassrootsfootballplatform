import type { PublishedRow } from "@/lib/standings";

/**
 * Table published by Batho Pele "As at 15 August 2026"
 * (QwaQwa Development League Open, Stream A; docs/reference/results 7.png).
 * 21 matches played: 15 decisive + 6 draws, 55 goals for and against.
 */
export const PUBLISHED_TABLE_2026_08_15: PublishedRow[] = [
  { position: 1, name: "Tseki Junior Stars FC", played: 7, won: 5, drawn: 2, lost: 0, goalsFor: 12, goalsAgainst: 5, goalDifference: 7, points: 17 },
  { position: 2, name: "Remember Matoota FC", played: 7, won: 3, drawn: 2, lost: 2, goalsFor: 13, goalsAgainst: 9, goalDifference: 4, points: 11 },
  { position: 3, name: "Passion FC", played: 7, won: 3, drawn: 1, lost: 3, goalsFor: 10, goalsAgainst: 12, goalDifference: -2, points: 10 },
  { position: 4, name: "Lere La Tshepe FC", played: 7, won: 2, drawn: 2, lost: 3, goalsFor: 7, goalsAgainst: 9, goalDifference: -2, points: 8 },
  { position: 5, name: "Samba Boys FC", played: 7, won: 1, drawn: 3, lost: 3, goalsFor: 8, goalsAgainst: 8, goalDifference: 0, points: 6 },
  { position: 6, name: "Tseki Galaxy FC", played: 7, won: 1, drawn: 2, lost: 4, goalsFor: 5, goalsAgainst: 12, goalDifference: -7, points: 5 },
];
