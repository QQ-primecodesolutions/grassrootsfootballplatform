"use client";

import { useActionState } from "react";
import { addScorerAction, scorerLinkAction, type PeopleState } from "@/app/admin/(panel)/people/actions";
import { LinkResult } from "./AdminInvites";
import { Field, FormMessage, inputClass } from "./fields";

const initial: PeopleState = { ok: false, message: null };

/** An organisation admin adds a scorer and gets a one-time link to send on WhatsApp. */
export function AddScorerForm() {
  const [state, action, pending] = useActionState(addScorerAction, initial);
  return (
    <div className="space-y-3">
      <form action={action} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Their name">
            <input name="name" required maxLength={80} autoComplete="off" className={inputClass} />
          </Field>
          <Field label="Their email" hint="They sign in with this">
            <input name="email" type="email" required maxLength={200} autoComplete="off" inputMode="email" className={inputClass} />
          </Field>
        </div>
        <button type="submit" disabled={pending} className="h-12 w-full rounded-lg bg-gray-900 font-semibold text-white disabled:opacity-60">
          {pending ? "Adding…" : "Add scorer"}
        </button>
      </form>
      <FormMessage ok={state.ok} message={state.message} />
      {state.link ? <LinkResult link={state.link} /> : null}
    </div>
  );
}

export function ScorerLinkButton({ userId, active }: { userId: string; active: boolean }) {
  const [state, action, pending] = useActionState(scorerLinkAction, initial);
  return (
    <div className="space-y-2">
      <form action={action}>
        <input type="hidden" name="userId" value={userId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-white px-3 py-2 text-sm font-semibold ring-1 ring-black/15 disabled:opacity-60"
        >
          {pending ? "Creating…" : active ? "Password reset link" : "New invite link"}
        </button>
      </form>
      {state.message && !state.link ? <FormMessage ok={state.ok} message={state.message} /> : null}
      {state.link ? <LinkResult link={state.link} /> : null}
    </div>
  );
}
