import type { CompetitionData, PublicOrganisation } from "@/lib/db/queries";
import {
  competitionSubtitle,
  displayState,
  isFinal,
  mainScore,
  STATE_LABEL,
  type PublicMatch,
  type PublicResult,
} from "@/lib/match/public";
import { readableTextOn } from "@/lib/public/color";
import { standingsFor, type TableRow } from "@/lib/public/views";
import { formatLongDate, formatTime, sastDateKey, sastDateTime } from "@/lib/time";

/**
 * Pure view models for the PNG graphics (no DB, no clock). Every score here comes from
 * `PublicMatch.result`, which is null unless the match is completed and confirmed, so a
 * provisional score can never reach a graphic.
 */

export type GraphicBrand = {
  orgName: string;
  orgLogoUrl: string | null;
  competitionName: string;
  /** "Stream A · Tseki" */
  competitionSubtitle: string | null;
  competitionLogoUrl: string | null;
  slogan: string | null;
  tagline: string | null;
  hashtags: string[];
  social: { facebook: boolean; instagram: boolean; x: boolean };
  sponsors: { name: string; logoUrl: string | null }[];
  colors: {
    primary: string;
    secondary: string;
    onPrimary: string;
    onSecondary: string;
    text: string;
    background: string;
  };
};

export function brandOf(org: PublicOrganisation, data: CompetitionData): GraphicBrand {
  const c = data.competition;
  return {
    orgName: org.name,
    orgLogoUrl: org.logoUrl,
    competitionName: c.name,
    competitionSubtitle: competitionSubtitle(c),
    competitionLogoUrl: c.logoUrl,
    slogan: c.slogan,
    tagline: org.tagline,
    hashtags: org.hashtags,
    // Icons only for links the organisation has actually supplied.
    social: {
      facebook: Boolean(org.socialLinks.facebook),
      instagram: Boolean(org.socialLinks.instagram),
      x: Boolean(org.socialLinks.x),
    },
    sponsors: data.sponsors.map((s) => ({ name: s.name, logoUrl: s.logoUrl })),
    colors: {
      primary: org.primaryColor,
      secondary: org.secondaryColor,
      onPrimary: readableTextOn(org.primaryColor),
      onSecondary: readableTextOn(org.secondaryColor),
      text: org.textColor,
      background: org.backgroundColor,
    },
  };
}

export type GraphicTableRow = {
  /** "1", or "2=" for a shared position. */
  position: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

export type GraphicResult = {
  home: string;
  away: string;
  /** "2-1", or "W/O" for a walkover. */
  score: string;
  /** "AET", "Pens 4-3", "Awarded" or null. */
  note: string | null;
};

export type MatchdayModel = {
  brand: GraphicBrand;
  /** SAST date the table is "as at" (YYYY-MM-DD); null when nothing has been played yet. */
  date: string | null;
  /** "15 August 2026" */
  dateLabel: string | null;
  rows: GraphicTableRow[];
  /** Confirmed results played on `date`. */
  results: GraphicResult[];
  top: GraphicTableRow[];
};

export type FixturesModel = {
  brand: GraphicBrand;
  date: string | null;
  dateLabel: string | null;
  fixtures: {
    home: string;
    away: string;
    /** "14:00", "TBC", or a status such as "POSTPONED". */
    time: string;
    venue: string | null;
    roundLabel: string | null;
  }[];
};

export type MatchCardModel = {
  brand: GraphicBrand;
  home: string;
  away: string;
  state: ReturnType<typeof displayState>;
  /** "2-1" / "W/O" for confirmed results only. */
  score: string | null;
  details: string[];
  roundLabel: string | null;
  /** "15 August 2026" */
  dateLabel: string | null;
  /** "14:00", or null when unknown. */
  timeLabel: string | null;
  venue: string | null;
};

const dateOf = (m: PublicMatch) => (m.kickoffAt ? sastDateKey(m.kickoffAt) : null);
const byKickoff = (a: PublicMatch, b: PublicMatch) =>
  (a.kickoffAt?.getTime() ?? Infinity) - (b.kickoffAt?.getTime() ?? Infinity) || a.id.localeCompare(b.id);

/** "2-1": a plain hyphen, as on the organisers' own graphics. */
const scoreText = (result: PublicResult | null) => mainScore(result)?.replace("–", "-") ?? null;

/** The SAST date of the most recent confirmed result, or null. */
export function latestResultDate(matches: PublicMatch[]): string | null {
  let latest: string | null = null;
  for (const m of matches) {
    const d = isFinal(m) ? dateOf(m) : null;
    if (d && (!latest || d > latest)) latest = d;
  }
  return latest;
}

/** The earliest SAST date with a scheduled or postponed match, or null. */
export function nextFixtureDate(matches: PublicMatch[]): string | null {
  let next: string | null = null;
  for (const m of matches) {
    const d = m.status === "scheduled" || m.status === "postponed" ? dateOf(m) : null;
    if (d && (!next || d < next)) next = d;
  }
  return next;
}

const longDateOf = (date: string) => formatLongDate(sastDateTime(date, "12:00"));

function toGraphicRow(r: TableRow): GraphicTableRow {
  return {
    position: r.tied ? `${r.position}=` : String(r.position),
    name: r.team.name,
    played: r.played,
    won: r.won,
    drawn: r.drawn,
    lost: r.lost,
    goalsFor: r.goalsFor,
    goalsAgainst: r.goalsAgainst,
    goalDifference: r.goalDifference,
    points: r.points,
  };
}

/** Name of the team a walkover was awarded to, if recorded. */
function walkoverWinner(m: PublicMatch): string | null {
  const id = m.result?.winnerEntryId;
  return id === m.home.entryId ? m.home.shortName || m.home.name : id === m.away.entryId ? m.away.shortName || m.away.name : null;
}

function resultNote(m: PublicMatch, result: PublicResult): string | null {
  if (result.outcomeType === "walkover") {
    const winner = walkoverWinner(m);
    return winner ? `W/O to ${winner}` : null;
  }
  if (result.outcomeType === "awarded") return "Awarded";
  if (result.penalties) return `Pens ${result.penalties.home}-${result.penalties.away}`;
  if (result.afterExtraTime) return "AET";
  return null;
}

/** Table as at `date` (default: the latest result date) plus that day's results and the top 3. */
export function matchdayModel(org: PublicOrganisation, data: CompetitionData, date: string | null): MatchdayModel {
  const asOf = date ?? latestResultDate(data.matches);
  const rows = standingsFor(data, asOf ? { asOf } : {}).map(toGraphicRow);
  const results: GraphicResult[] = [];
  if (asOf) {
    for (const m of [...data.matches].sort(byKickoff)) {
      const score = scoreText(m.result);
      if (!m.result || !score || dateOf(m) !== asOf) continue;
      results.push({ home: m.home.name, away: m.away.name, score, note: resultNote(m, m.result) });
    }
  }
  return {
    brand: brandOf(org, data),
    date: asOf,
    dateLabel: asOf ? longDateOf(asOf) : null,
    rows,
    results,
    top: rows.slice(0, 3),
  };
}

/** Every match on `date` (default: the next date with a scheduled or postponed match). */
export function fixturesModel(org: PublicOrganisation, data: CompetitionData, date: string | null): FixturesModel {
  const day = date ?? nextFixtureDate(data.matches);
  const fixtures = day
    ? data.matches
        .filter((m) => dateOf(m) === day)
        .sort(byKickoff)
        .map((m) => {
          const state = displayState(m);
          const time =
            m.status === "postponed" || m.status === "cancelled" || m.status === "abandoned"
              ? STATE_LABEL[state].toUpperCase()
              : m.kickoffAt && !m.kickoffTimeTbc
                ? formatTime(m.kickoffAt)
                : "TBC";
          return { home: m.home.name, away: m.away.name, time, venue: m.venue?.name ?? null, roundLabel: m.roundLabel };
        })
    : [];
  return { brand: brandOf(org, data), date: day, dateLabel: day ? longDateOf(day) : null, fixtures };
}

/** A single match. Scores appear only for confirmed results (`m.result` is null otherwise). */
export function matchCardModel(org: PublicOrganisation, data: CompetitionData, m: PublicMatch): MatchCardModel {
  const details: string[] = [];
  const r = m.result;
  if (r) {
    if (r.outcomeType === "walkover") {
      const winner = r.winnerEntryId === m.home.entryId ? m.home.name : r.winnerEntryId === m.away.entryId ? m.away.name : null;
      details.push(winner ? `Walkover: ${winner} win` : "Walkover");
    }
    if (r.outcomeType === "awarded") details.push("Awarded");
    if (r.afterExtraTime && r.fullTime) details.push(`AET · 90 mins ${r.fullTime.home}-${r.fullTime.away}`);
    if (r.penalties) details.push(`Penalties ${r.penalties.home}-${r.penalties.away}`);
    if (r.halfTime) details.push(`HT ${r.halfTime.home}-${r.halfTime.away}`);
  }
  return {
    brand: brandOf(org, data),
    home: m.home.name,
    away: m.away.name,
    state: displayState(m),
    score: scoreText(r),
    details,
    roundLabel: m.roundLabel,
    dateLabel: m.kickoffAt ? formatLongDate(m.kickoffAt) : null,
    timeLabel: m.kickoffAt && !m.kickoffTimeTbc ? formatTime(m.kickoffAt) : null,
    venue: m.venue?.name ?? null,
  };
}
