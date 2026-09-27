import type { Db } from "@/lib/db/client";
import { sastDateTime } from "@/lib/time";
import {
  STREAM_A_RESULTS,
  STREAM_A_SEASON_MATCHES,
  STREAM_A_TEAMS,
  type SeedResult,
} from "./data/batho-pele-stream-a";
import {
  upsertCompetition,
  upsertEntries,
  upsertMatch,
  upsertOrganisation,
  upsertSeason,
  upsertSponsors,
  upsertTeam,
  upsertVenue,
  type SeedCounters,
} from "./upsert";

export const BATHO_PELE_SLUG = "batho-pele";
export const STREAM_A_SLUG = "qdl-open-stream-a-2026";

/**
 * Upserts the organisation, Stream A competition, teams and sponsors, then inserts
 * `results` (default: only the organiser-published 15 Aug results). Existing matches
 * are skipped by natural key unless `overwriteResults`.
 */
export async function seedBathoPele(
  db: Db,
  opts: { overwriteResults: boolean; counters: SeedCounters; results?: SeedResult[] },
) {
  const org = await upsertOrganisation(db, {
    slug: BATHO_PELE_SLUG,
    name: "Batho Pele Kasi Soccer Tournament",
    shortName: "Batho Pele",
    // Sampled from docs/reference/results 7.png: tables, banners and position boxes are ~#03300B.
    // Secondary is the brief's brighter green, used for accents.
    primaryColor: "#03300B",
    secondaryColor: "#1E6B34",
    textColor: "#111111",
    backgroundColor: "#F4F4F2",
    tagline: "ONE GAME. ONE PASSION. ONE LEAGUE.",
    hashtags: ["#ITSTIMETOSHINE", "#QDL", "#BathoPeleKasiSoccerTournament"],
    socialLinks: {}, // To be supplied by the organiser; icons stay hidden until then.
  });

  const season = await upsertSeason(db, org.id, "2026");

  // Venue shown on the organiser's round 1 fixtures graphic (docs/reference/fixture 1.jpg).
  const venueIdByName = new Map<string, string>();
  const itlotliseng = await upsertVenue(db, org.id, { name: "Itlotliseng Sports Ground" });
  venueIdByName.set("Itlotliseng Sports Ground", itlotliseng.id);

  // Each team in its own club until the organiser confirms any shared clubs.
  // Gender left null until confirmed.
  const teamIdByName = new Map<string, string>();
  for (const team of STREAM_A_TEAMS) {
    const id = await upsertTeam(db, org.id, {
      club: team.name,
      name: team.name,
      shortName: team.shortName,
      category: "Open",
      gender: null,
      aliases: [...team.aliases],
    });
    teamIdByName.set(team.name, id);
  }

  // Batho Pele runs the Open/Senior league of the QwaQwa Development League U19 (the parent
  // body) in two streams: A (Tseki) and B (Phuthaditjhaba). The competition carries the QDL
  // brand (logo to be supplied, slogan); graphics show org + QDL logos side by side.
  // Stream B is not seeded until the organiser supplies its teams and results.
  const competition = await upsertCompetition(db, {
    organisationId: org.id,
    seasonId: season.id,
    name: "QwaQwa Development League Open",
    slug: STREAM_A_SLUG,
    type: "league",
    streamLabel: "Stream A",
    area: "Tseki",
    slogan: "It's time to shine",
    expectedMatchCount: STREAM_A_SEASON_MATCHES,
    isFeatured: true,
  });

  const entryByTeamId = await upsertEntries(db, org.id, competition.id, [...teamIdByName.values()]);
  const entryFor = (teamName: string) => {
    const teamId = teamIdByName.get(teamName);
    const entryId = teamId && entryByTeamId.get(teamId);
    if (!entryId) throw new Error(`Unknown Stream A team "${teamName}" in seed results`);
    return entryId;
  };

  // Names only; logos to be supplied. Others on the graphic await organiser confirmation.
  await upsertSponsors(db, org.id, competition.id, ["Mayday Alarms", "RE/MAX Maluti", "Prestige", "Next Business"]);

  const now = new Date();
  for (const r of opts.results ?? STREAM_A_RESULTS) {
    const homeEntryId = entryFor(r.home);
    const awayEntryId = entryFor(r.away);
    let venueId: string | null = null;
    if (r.venue) {
      venueId = venueIdByName.get(r.venue) ?? (await upsertVenue(db, org.id, { name: r.venue })).id;
      venueIdByName.set(r.venue, venueId);
    }
    await upsertMatch(
      db,
      org.id,
      competition.id,
      {
        roundLabel: `Round ${r.round}`,
        roundNumber: r.round,
        homeEntryId,
        awayEntryId,
        venueId,
        kickoffAt: sastDateTime(r.date, r.time ?? "00:00"),
        kickoffTimeTbc: r.time === undefined,
        status: "completed",
        outcomeType: r.outcome ?? "normal",
        homeGoals: r.homeGoals,
        awayGoals: r.awayGoals,
        winnerEntryId: r.homeGoals > r.awayGoals ? homeEntryId : r.awayGoals > r.homeGoals ? awayEntryId : null,
        resultState: "confirmed",
        confirmedAt: now,
        notes: r.notes ?? null,
      },
      { overwrite: opts.overwriteResults, counters: opts.counters },
    );
  }

  return { organisationId: org.id, competitionId: competition.id };
}
