/** Password rules shared by the forms (client) and the actions (server). */

export const PASSWORD_MIN_LENGTH = 10;

/** Why a new password isn't acceptable, or null. Long passphrases beat complexity rules. */
export function passwordProblem(password: string, email: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH)
    return `Use at least ${PASSWORD_MIN_LENGTH} characters. Three or four random words work well.`;
  if (password.length > 200) return "Use at most 200 characters.";
  if (password.trim().toLowerCase() === email.trim().toLowerCase()) return "Don't use your email address as the password.";
  return null;
}
