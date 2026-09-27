/**
 * Cache tag names for public data. Queries tag what they read; admin actions
 * (Milestone 4) invalidate exactly these tags so public pages update within seconds.
 */

/** The list of organisations shown on "/". */
export const ORGANISATIONS_TAG = "organisations";

/** Everything belonging to one organisation (branding, competitions, …). */
export const orgTag = (organisationId: string) => `org:${organisationId}`;

/** A competition's entries, matches, adjustments and therefore its table. */
export const competitionTag = (competitionId: string) => `competition:${competitionId}`;

export const matchTag = (matchId: string) => `match:${matchId}`;

export const teamTag = (teamId: string) => `team:${teamId}`;

/** Tags to invalidate after a match result, status or fixture change. */
export function tagsForMatchChange(input: {
  organisationId: string;
  competitionId: string;
  matchId: string;
  teamIds: string[];
}): string[] {
  return [
    orgTag(input.organisationId),
    competitionTag(input.competitionId),
    matchTag(input.matchId),
    ...input.teamIds.map(teamTag),
  ];
}
