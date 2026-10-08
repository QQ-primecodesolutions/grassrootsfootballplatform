/**
 * Share text for fixtures (before matches are played). Pure: callers pass formatted strings.
 */

export type FixtureLine = {
  homeName: string;
  awayName: string;
  /** "14:00", or null when the time is still to be confirmed. */
  time: string | null;
  venueName: string | null;
  roundLabel: string | null;
};

export type FixturesShareInput = {
  /** e.g. "QwaQwa Development League Open · Stream A" */
  competitionLine: string;
  /** e.g. "Sat, 12 Oct" */
  dateLabel: string;
  fixtures: FixtureLine[];
  hashtags: string[];
  /** Public fixtures page. */
  url: string;
};

function fixtureLine(f: FixtureLine, showRound: boolean): string {
  const extras = [showRound ? f.roundLabel : null, f.venueName].filter(Boolean);
  return `${f.time ?? "TBC"}  ${f.homeName} vs ${f.awayName}${extras.length ? ` (${extras.join(", ")})` : ""}`;
}

/** WhatsApp message for a match day: one line per fixture, then the link. */
export function whatsappFixturesText(i: FixturesShareInput): string {
  const rounds = new Set(i.fixtures.map((f) => f.roundLabel).filter(Boolean));
  // One shared round goes in the header; mixed rounds are shown per fixture.
  const sharedRound = rounds.size === 1 && i.fixtures.every((f) => f.roundLabel) ? [...rounds][0] : null;
  const header = [`FIXTURES · ${i.dateLabel}`, [i.competitionLine, sharedRound].filter(Boolean).join(" · ")];
  const blocks = [
    header.join("\n"),
    i.fixtures.map((f) => fixtureLine(f, !sharedRound)).join("\n"),
    i.url,
    i.hashtags.join(" "),
  ];
  return blocks.filter(Boolean).join("\n\n");
}

export type MatchPreviewInput = FixtureLine & {
  competitionLine: string;
  dateLabel: string | null;
  hashtags: string[];
  matchUrl: string;
};

/** WhatsApp message announcing one match. */
export function whatsappMatchPreviewText(i: MatchPreviewInput): string {
  const when = [i.dateLabel ?? "Date to be confirmed", i.dateLabel ? (i.time ?? "time TBC") : null, i.venueName]
    .filter(Boolean)
    .join(" · ");
  const blocks = [
    `MATCH DAY: ${i.homeName} vs ${i.awayName}`,
    [when, [i.competitionLine, i.roundLabel].filter(Boolean).join(" · ")].join("\n"),
    i.matchUrl,
    i.hashtags.join(" "),
  ];
  return blocks.filter(Boolean).join("\n\n");
}
