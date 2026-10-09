import { aliasedTable, and, desc, eq, inArray } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { ORGANISATIONS_TAG, orgTag } from "@/lib/cache/tags";
import { getDb } from "@/lib/db/client";
import { competitionEntries, competitions, matches, organisations, teams } from "@/lib/db/schema";
import { mainScore, scoreDetails, toPublicResult } from "@/lib/match/public";

/*
 * The homepage's "Latest results" strip: the newest confirmed results from every LISTED
 * organisation. Public data only (scores come from toPublicResult, so a provisional score can
 * never appear). This is the one cross-organisation read; it only ever returns what each
 * organisation already shows publicly.
 */

export type LatestResult = {
  matchId: string;
  orgSlug: string;
  orgName: string;
  competitionName: string;
  kickoffAt: Date;
  home: string;
  away: string;
  score: string;
  /** e.g. "Penalties 4–5", "Walkover". */
  note: string | null;
};

const home = aliasedTable(teams, "home_team");
const away = aliasedTable(teams, "away_team");
const homeEntry = aliasedTable(competitionEntries, "home_entry");
const awayEntry = aliasedTable(competitionEntries, "away_entry");

export async function listLatestResults(limit = 6): Promise<LatestResult[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(ORGANISATIONS_TAG);
  const db = getDb();
  const listed = await db
    .select({ id: organisations.id })
    .from(organisations)
    .where(eq(organisations.listed, true));
  // Any result saved in any listed organisation invalidates its org tag, and so this list.
  for (const o of listed) cacheTag(orgTag(o.id));
  if (!listed.length) return [];

  const rows = await db
    .select({
      m: matches,
      orgSlug: organisations.slug,
      orgName: organisations.name,
      competitionName: competitions.name,
      home: home.name,
      homeDisplay: homeEntry.displayName,
      away: away.name,
      awayDisplay: awayEntry.displayName,
    })
    .from(matches)
    .innerJoin(organisations, eq(organisations.id, matches.organisationId))
    .innerJoin(competitions, eq(competitions.id, matches.competitionId))
    .innerJoin(homeEntry, eq(homeEntry.id, matches.homeEntryId))
    .innerJoin(home, eq(home.id, homeEntry.teamId))
    .innerJoin(awayEntry, eq(awayEntry.id, matches.awayEntryId))
    .innerJoin(away, eq(away.id, awayEntry.teamId))
    .where(
      and(
        inArray(
          matches.organisationId,
          listed.map((o) => o.id),
        ),
        eq(matches.status, "completed"),
        eq(matches.resultState, "confirmed"),
      ),
    )
    .orderBy(desc(matches.kickoffAt), desc(matches.confirmedAt))
    .limit(limit);

  return rows.flatMap((r) => {
    const result = toPublicResult(r.m);
    const score = mainScore(result);
    if (!result || !score || !r.m.kickoffAt) return [];
    const note = scoreDetails(result).find((d) => !d.startsWith("HT ")) ?? null;
    return [
      {
        matchId: r.m.id,
        orgSlug: r.orgSlug,
        orgName: r.orgName,
        competitionName: r.competitionName,
        kickoffAt: r.m.kickoffAt,
        home: r.homeDisplay ?? r.home,
        away: r.awayDisplay ?? r.away,
        score,
        note,
      },
    ];
  });
}
