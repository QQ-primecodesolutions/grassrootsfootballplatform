/**
 * Batho Pele — QwaQwa Development League Open (Senior), Stream A (Tseki).
 *
 * REAL ORGANISATION: only results the organiser has published or supplied go here.
 * Never invent or "fill in" results. Add the remaining rounds as the organiser
 * confirms them; `pnpm db:seed` inserts new rows and skips existing ones
 * (matched on competition + home + away + SAST date).
 *
 * `home`/`away` use the official team names below. `time` is optional; without
 * it the kickoff is stored as the date with "time TBC".
 */

export type SeedResult = {
  round: number;
  date: string; // YYYY-MM-DD (SAST)
  time?: string; // HH:MM (SAST)
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
  venue?: string;
  outcome?: "normal" | "awarded";
  notes?: string;
};

export const STREAM_A_TEAMS = [
  {
    name: "Tseki Junior Stars FC",
    shortName: "Tseki Jnr Stars",
    aliases: ["Tseki Junior Stars", "Tseki Jnr Stars"],
  },
  { name: "Remember Matoota FC", shortName: "Remember Matoota", aliases: ["Remember Matoota"] },
  { name: "Passion FC", shortName: "Passion", aliases: ["Passion"] },
  { name: "Lere La Tshepe FC", shortName: "Lere La Tshepe", aliases: ["Lere La Tshepe"] },
  { name: "Samba Boys FC", shortName: "Samba Boys", aliases: ["Samba Boys"] },
  { name: "Tseki Galaxy FC", shortName: "Tseki Galaxy", aliases: ["Tseki Galaxy"] },
] as const;

/** Source: Batho Pele matchday graphic "As at 15 August 2026" (docs/reference/results 7.png). */
export const STREAM_A_RESULTS: SeedResult[] = [
  { round: 7, date: "2026-08-15", home: "Tseki Junior Stars FC", away: "Samba Boys FC", homeGoals: 2, awayGoals: 1 },
  { round: 7, date: "2026-08-15", home: "Tseki Galaxy FC", away: "Lere La Tshepe FC", homeGoals: 1, awayGoals: 2 },
  { round: 7, date: "2026-08-15", home: "Remember Matoota FC", away: "Passion FC", homeGoals: 0, awayGoals: 0 },
];

/** Matches played by 15 Aug 2026, per the published table (6 teams × 7 GP / 2). */
export const STREAM_A_PLAYED_BY_2026_08_15 = 21;
/** Double round-robin of 6 teams (assumption, PLAN.md decision 3). */
export const STREAM_A_SEASON_MATCHES = 30;
