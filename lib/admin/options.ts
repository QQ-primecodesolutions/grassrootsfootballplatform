import type { AdminCompetition } from "@/lib/db/queries/admin";

/** Shape competitions for admin pickers ("Name — Stream A · Tseki (2026)"). */
export function competitionOptions(competitions: AdminCompetition[]) {
  return competitions.map((c) => ({
    id: c.id,
    label: [c.name, [c.streamLabel, c.area].filter(Boolean).join(" · ")].filter(Boolean).join(" — ") + ` (${c.seasonName})`,
    entries: c.entries.map((e) => ({ entryId: e.entryId, teamId: e.teamId, name: e.name, aliases: e.aliases })),
  }));
}
