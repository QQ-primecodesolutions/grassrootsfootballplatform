import type { Db } from "@/lib/db/client";
import { sastDateTime } from "@/lib/time";
import { addDays, createRng, randomGoals, roundRobin } from "./generate";
import {
  upsertCompetition,
  upsertEntries,
  upsertMatch,
  upsertOrganisation,
  upsertPointsAdjustment,
  upsertSeason,
  upsertSponsors,
  upsertTeam,
  upsertVenue,
  type SeedCounters,
} from "./upsert";

/*
 * Demo Community League: obviously fictional data for development and screenshots.
 * Fixed dates (not "relative to today") keep the seed idempotent.
 *
 * League: 8 teams, double round-robin, Saturdays from 15 Aug 2026.
 *   Rounds 1–6 confirmed (one walkover in round 4), round 7 mixed
 *   (confirmed / provisional / postponed), rounds 8–14 scheduled.
 *   One points deduction.
 * Cup: 4-team knockout; one semi-final won on penalties after extra time.
 */

export const DEMO_SLUG = "demo";
export const DEMO_LEAGUE_SLUG = "demo-premier-league-2026";
export const DEMO_CUP_SLUG = "demo-cup-2026";

const DEMO_TEAMS = [
  "Riverside Rovers FC",
  "Hilltop Hawks FC",
  "Sunrise Strikers FC",
  "Valley Vipers FC",
  "Meadow Mavericks FC",
  "Canyon Comets FC",
  "Harbour Hornets FC",
  "Orchard Owls FC",
] as const;

const KICKOFFS = ["10:00", "12:00", "14:00", "16:00"] as const;
const FIRST_ROUND = "2026-08-15";

export async function seedDemo(db: Db, opts: { overwriteResults: boolean; counters: SeedCounters }) {
  const matchOpts = { overwrite: opts.overwriteResults, counters: opts.counters };

  const org = await upsertOrganisation(db, {
    slug: DEMO_SLUG,
    name: "Demo Community League",
    shortName: "Demo League",
    primaryColor: "#1D3A8A",
    secondaryColor: "#E0A100",
    textColor: "#111111",
    backgroundColor: "#F5F6FA",
    tagline: "PLAY FAIR. PLAY HARD. PLAY TOGETHER.",
    hashtags: ["#DemoLeague", "#GrassrootsFootball"],
    socialLinks: {},
  });
  const season = await upsertSeason(db, org.id, "2026");
  const venues = [
    (await upsertVenue(db, org.id, { name: "Riverside Sports Ground", area: "Riverside" })).id,
    (await upsertVenue(db, org.id, { name: "Hilltop Community Field", area: "Hilltop" })).id,
  ];

  const teamIds: string[] = [];
  for (const name of DEMO_TEAMS) {
    const short = name.replace(/ FC$/, "");
    teamIds.push(
      await upsertTeam(db, org.id, {
        club: short,
        name,
        shortName: short,
        category: "Open",
        gender: "male",
        aliases: [short],
      }),
    );
  }
  // A club fielding a second team (not entered in the league) to exercise club → teams.
  await upsertTeam(db, org.id, {
    club: "Riverside Rovers",
    name: "Riverside Rovers U19",
    shortName: "Riverside U19",
    category: "U19",
    gender: "male",
    aliases: ["Riverside Juniors"],
  });

  // --- League ---------------------------------------------------------------
  const league = await upsertCompetition(db, {
    organisationId: org.id,
    seasonId: season.id,
    name: "Demo Premier League",
    slug: DEMO_LEAGUE_SLUG,
    type: "league",
    slogan: "Every game counts",
    expectedMatchCount: 56,
    isFeatured: true,
    sortOrder: 0,
  });
  const leagueEntries = await upsertEntries(db, org.id, league.id, teamIds);
  const entry = (teamIndex: number) => leagueEntries.get(teamIds[teamIndex]!)!;
  await upsertSponsors(db, org.id, league.id, ["Example Hardware", "Sample Spaza", "Placeholder Taxi Association"]);

  const rng = createRng(2026);
  const rounds = roundRobin(DEMO_TEAMS.length, { double: true });
  for (const [r, pairs] of rounds.entries()) {
    const round = r + 1;
    const date = addDays(FIRST_ROUND, r * 7);
    for (const [i, [home, away]] of pairs.entries()) {
      const homeEntryId = entry(home);
      const awayEntryId = entry(away);
      const base = {
        roundLabel: `Round ${round}`,
        roundNumber: round,
        homeEntryId,
        awayEntryId,
        venueId: venues[i % venues.length]!,
        kickoffAt: sastDateTime(date, KICKOFFS[i]!),
      };
      // Draw scores for every played-or-planned match so the sequence is stable.
      const hg = randomGoals(rng);
      const ag = randomGoals(rng);
      const htHome = Math.floor(hg / 2);
      const htAway = Math.floor(ag / 2);
      const winnerEntryId = hg > ag ? homeEntryId : ag > hg ? awayEntryId : null;
      const confirmed = {
        status: "completed" as const,
        outcomeType: "normal" as const,
        homeGoals: hg,
        awayGoals: ag,
        htHomeGoals: htHome,
        htAwayGoals: htAway,
        winnerEntryId,
        resultState: "confirmed" as const,
        confirmedAt: sastDateTime(date, "18:00"),
      };

      if (round === 4 && i === 2) {
        // Walkover: away side failed to arrive.
        await upsertMatch(db, org.id, league.id, {
          ...base,
          status: "completed",
          outcomeType: "walkover",
          winnerEntryId: homeEntryId,
          resultState: "confirmed",
          confirmedAt: sastDateTime(date, "18:00"),
          notes: "Walkover: opponents did not arrive (demo data).",
        }, matchOpts);
      } else if (round <= 6 || (round === 7 && i <= 1)) {
        await upsertMatch(db, org.id, league.id, { ...base, ...confirmed }, matchOpts);
      } else if (round === 7 && i === 2) {
        // Entered at the pitch, not yet confirmed: must never show as final publicly.
        await upsertMatch(db, org.id, league.id, { ...base, ...confirmed, resultState: "provisional", confirmedAt: null }, matchOpts);
      } else if (round === 7 && i === 3) {
        await upsertMatch(db, org.id, league.id, {
          ...base,
          status: "postponed",
          notes: "Postponed: waterlogged pitch (demo data).",
        }, matchOpts);
      } else {
        await upsertMatch(db, org.id, league.id, { ...base, status: "scheduled" }, matchOpts);
      }
    }
  }

  await upsertPointsAdjustment(db, {
    organisationId: org.id,
    competitionId: league.id,
    entryId: entry(5), // Canyon Comets
    points: -3,
    reason: "Fielded an unregistered player (demo data)",
    effectiveOn: "2026-09-07",
  });

  // --- Cup (knockout) -------------------------------------------------------
  const cup = await upsertCompetition(db, {
    organisationId: org.id,
    seasonId: season.id,
    name: "Demo Knockout Cup",
    slug: DEMO_CUP_SLUG,
    type: "knockout",
    sortOrder: 1,
  });
  const cupTeams = [teamIds[0]!, teamIds[1]!, teamIds[2]!, teamIds[3]!];
  const cupEntries = await upsertEntries(db, org.id, cup.id, cupTeams);
  const cupEntry = (i: number) => cupEntries.get(cupTeams[i]!)!;
  const semiDate = "2026-09-20";

  // Semi-final 1: normal-time win.
  await upsertMatch(db, org.id, cup.id, {
    roundLabel: "Semi-final",
    roundNumber: 1,
    homeEntryId: cupEntry(0),
    awayEntryId: cupEntry(3),
    venueId: venues[0]!,
    kickoffAt: sastDateTime(semiDate, "11:00"),
    status: "completed",
    homeGoals: 2,
    awayGoals: 1,
    htHomeGoals: 1,
    htAwayGoals: 0,
    winnerEntryId: cupEntry(0),
    resultState: "confirmed",
    confirmedAt: sastDateTime(semiDate, "18:00"),
  }, matchOpts);

  // Semi-final 2: 1–1 after 90, 2–2 after extra time, away side wins 5–4 on penalties.
  await upsertMatch(db, org.id, cup.id, {
    roundLabel: "Semi-final",
    roundNumber: 1,
    homeEntryId: cupEntry(1),
    awayEntryId: cupEntry(2),
    venueId: venues[1]!,
    kickoffAt: sastDateTime(semiDate, "14:00"),
    status: "completed",
    homeGoals: 1,
    awayGoals: 1,
    htHomeGoals: 0,
    htAwayGoals: 1,
    aetHomeGoals: 2,
    aetAwayGoals: 2,
    penHome: 4,
    penAway: 5,
    winnerEntryId: cupEntry(2),
    resultState: "confirmed",
    confirmedAt: sastDateTime(semiDate, "18:00"),
  }, matchOpts);

  // Final: scheduled.
  await upsertMatch(db, org.id, cup.id, {
    roundLabel: "Final",
    roundNumber: 2,
    homeEntryId: cupEntry(0),
    awayEntryId: cupEntry(2),
    venueId: venues[0]!,
    kickoffAt: sastDateTime("2026-10-18", "15:00"),
    status: "scheduled",
  }, matchOpts);

  return { organisationId: org.id, leagueId: league.id, cupId: cup.id };
}
