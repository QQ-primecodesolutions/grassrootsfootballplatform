"use client";

import { useActionState } from "react";
import { addAliasAction, type TeamFormState } from "@/app/admin/(panel)/teams/actions";
import { FormMessage, inputClass } from "./fields";

export function AliasForm({ teamId }: { teamId: string }) {
  const [state, action, pending] = useActionState<TeamFormState, FormData>(addAliasAction, { ok: false, message: null });
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="teamId" value={teamId} />
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="alias">
          Other spelling
        </label>
        <input id="alias" name="alias" placeholder='e.g. "Tseki Jnr Stars"' required maxLength={80} className={`${inputClass} mt-0`} />
        <button type="submit" disabled={pending} className="shrink-0 rounded-lg bg-gray-900 px-4 font-semibold text-white disabled:opacity-60">
          Add
        </button>
      </div>
      <FormMessage ok={state.ok} message={state.message} />
    </form>
  );
}
