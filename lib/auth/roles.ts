/**
 * Roles within an organisation (pure).
 * - admin: everything (a super admin is an admin of every organisation).
 * - scorer: enters scores for played matches. They stay provisional (private) until an admin
 *   publishes them, so only someone the organiser trusts decides what goes public.
 */

export type OrgRole = "admin" | "scorer";

export function orgRoleOf(isSuperAdmin: boolean, memberRole: "org_admin" | "scorer" | null): OrgRole {
  return isSuperAdmin || memberRole !== "scorer" ? "admin" : "scorer";
}

export const ROLE_LABELS: Record<"org_admin" | "scorer", string> = {
  org_admin: "Organisation admin",
  scorer: "Scorer",
};

/** Why a scorer may not make this save, or null if they may. */
export function scorerSaveProblem(
  input: { intent: "provisional" | "confirm"; status: string },
  match: { status: string; resultState: "provisional" | "confirmed" },
): string | null {
  if (match.status === "completed" && match.resultState === "confirmed") {
    return "This result is already published. Only an organisation admin can change it.";
  }
  if (input.intent === "confirm") return "Only an organisation admin can publish a result.";
  if (input.status !== "completed") return "Scorers can only enter the score of a played match.";
  return null;
}
