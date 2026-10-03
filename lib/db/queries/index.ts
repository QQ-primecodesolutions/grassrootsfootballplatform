/**
 * The only entry point for reading tenant data (CLAUDE.md rule 3). Every tenant
 * query takes an OrgScope obtained from resolveOrgBySlug() or getCurrentAdmin().
 */
export {
  listOrganisations,
  resolveOrgBySlug,
  type OrgScope,
  type PublicOrganisation,
  type SocialLinks,
} from "./organisations";
export {
  findMatchCompetitionSlug,
  getCompetitionData,
  getTeamBySlug,
  listCompetitions,
  type CompetitionData,
  type CompetitionSummary,
  type TeamSummary,
} from "./competitions";
