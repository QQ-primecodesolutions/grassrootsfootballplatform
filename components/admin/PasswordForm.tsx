"use client";

import { useActionState } from "react";
import type { PasswordFormState } from "@/app/admin/actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password-rules";
import { Field, FormMessage, inputClass } from "./fields";

/** New password + confirm (and optionally the current one), for invite/reset links and the account page. */
export function PasswordFields({
  action,
  hidden = {},
  email,
  askCurrent = false,
  submitLabel,
}: {
  action: (prev: PasswordFormState, formData: FormData) => Promise<PasswordFormState>;
  hidden?: Record<string, string>;
  email: string;
  askCurrent?: boolean;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<PasswordFormState, FormData>(action, { ok: false, message: null });

  return (
    <form action={formAction} className="mt-6 space-y-4">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {/* Lets password managers save the login under the right email. */}
      <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
      {askCurrent ? (
        <Field label="Current password">
          <input name="current" type="password" autoComplete="current-password" required maxLength={200} className={inputClass} />
        </Field>
      ) : null}
      <Field label="New password" hint={`At least ${PASSWORD_MIN_LENGTH} characters. Three or four random words are easy to type and hard to guess.`}>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={200}
          className={inputClass}
        />
      </Field>
      <Field label="Type it again">
        <input name="confirm" type="password" autoComplete="new-password" required maxLength={200} className={inputClass} />
      </Field>
      <FormMessage ok={state.ok} message={state.message} />
      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-lg bg-gray-900 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
