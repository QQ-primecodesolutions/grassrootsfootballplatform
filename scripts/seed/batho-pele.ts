import type { Db } from "@/lib/db/client";
import { sastDateTime } from "@/lib/time";
import {
  STREAM_A_RESULTS,
  STREAM_A_SEASON_MATCHES,
  STREAM_A_TEAMS,
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
export const STREAM_A_SLUG = "qdl-u19-stream-a-2026";

export async function seedBathoPele(db: Db, opts: { overwriteResults: boolean; counters: SeedCounters }) {
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
      category: "U19",
      gender: null,
      aliases: [...team.aliases],
    });
    teamIdByName.set(team.name, id);
  }

  // "QwaQwa Development League U19" is the competition brand (umbrella body), with its own
  // logo (to be supplied) and slogan. Graphics show org + competition logos side by side.
  const competition = await upsertCompetition(db, {
    organisationId: org.id,
    seasonId: season.id,
    name: "QwaQwa Development League U19",
    slug: STREAM_A_SLUG,
    type: "league",
    streamLabel: "Stream A",
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
  for (const r of STREAM_A_RESULTS) {
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
