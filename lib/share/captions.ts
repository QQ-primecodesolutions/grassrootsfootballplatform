/**
 * Share captions for WhatsApp and Facebook. Pure: callers pass formatted strings.
 */

export type ResultShareInput = {
  homeName: string;
  awayName: string;
  /** e.g. "2–1" or "W/O" */
  score: string;
  /** e.g. ["After extra time (90′: 1–1)", "Penalties 4–5"] */
  details: string[];
  competitionName: string;
  /** e.g. "Stream A · Tseki" */
  competitionSubtitle: string | null;
  roundLabel: string | null;
  /** e.g. "Sat, 15 Aug" */
  dateLabel: string | null;
  venueName: string | null;
  hashtags: string[];
  matchUrl: string;
  tableUrl: string;
};

function competitionLine(i: ResultShareInput): string {
  return [i.competitionName, i.competitionSubtitle, i.roundLabel].filter(Boolean).join(" · ");
}

/** Short message for WhatsApp groups: result, competition, link. */
export function whatsappResultText(i: ResultShareInput): string {
  const lines = [
    `FULL TIME: ${i.homeName} ${i.score} ${i.awayName}`,
    ...i.details.filter((d) => !d.startsWith("HT ")),
    competitionLine(i),
    i.matchUrl,
  ];
  return lines.filter(Boolean).join("\n");
}

/** Longer Facebook post with hashtags and the table link. */
export function facebookResultCaption(i: ResultShareInput): string {
  const where = [i.dateLabel, i.venueName].filter(Boolean).join(" · ");
  const blocks = [
    "FULL TIME ⚽",
    [`${i.homeName} ${i.score} ${i.awayName}`, ...i.details].join("\n"),
    [competitionLine(i), where].filter(Boolean).join("\n"),
    `Match: ${i.matchUrl}\nLog/table: ${i.tableUrl}`,
    i.hashtags.join(" "),
  ];
  return blocks.filter(Boolean).join("\n\n");
}

/** WhatsApp "click to chat" link that opens the share sheet with the text filled in. */
export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
