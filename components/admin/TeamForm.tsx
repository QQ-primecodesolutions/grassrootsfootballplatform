"use client";

import { useActionState, useState } from "react";
import { createTeamAction, updateTeamAction, type TeamFormState } from "@/app/admin/(panel)/teams/actions";
import { Field, FormMessage, inputClass } from "./fields";

export type TeamFormValues = {
  id?: string;
  name: string;
  shortName: string;
  category: string;
  gender: "male" | "female" | "mixed" | null;
  logoUrl: string | null;
  clubId: string | null;
};

const CATEGORY_SUGGESTIONS = ["Open", "U13", "U15", "U17", "U19", "U21", "Veterans"];

export function TeamForm({ team, clubs }: { team?: TeamFormValues; clubs: { id: string; name: string }[] }) {
  const editing = Boolean(team?.id);
  const [state, action, pending] = useActionState<TeamFormState, FormData>(editing ? updateTeamAction : createTeamAction, {
    ok: false,
    message: null,
  });
  const [clubId, setClubId] = useState(team?.clubId ?? "__new");

  return (
    <form action={action} className="space-y-3">
      {team?.id ? <input type="hidden" name="teamId" value={team.id} /> : null}
      <Field label="Official name" hint='As it should appear publicly, e.g. "Passion FC"'>
        <input name="name" defaultValue={team?.name} required maxLength={80} className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Short name" hint="For graphics">
          <input name="shortName" defaultValue={team?.shortName} required maxLength={24} className={inputClass} />
        </Field>
        <Field label="Category">
          <input name="category" defaultValue={team?.category ?? "Open"} list="team-categories" required maxLength={20} className={inputClass} />
          <datalist id="team-categories">
            {CATEGORY_SUGGESTIONS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
      </div>
      <Field label="Gender" hint="Leave as “Not set” until the organiser confirms">
        <select name="gender" defaultValue={team?.gender ?? ""} className={inputClass}>
          <option value="">Not set</option>
          <option value="male">Men / boys</option>
          <option value="female">Women / girls</option>
          <option value="mixed">Mixed</option>
        </select>
      </Field>
      <Field label="Club" hint="A club can field several teams (e.g. an U19 and an Open side)">
        <select name="clubId" value={clubId} onChange={(e) => setClubId(e.target.value)} className={inputClass}>
          <option value="__new">+ New club</option>
          {clubs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      {clubId === "__new" ? (
        <Field label="New club name" hint="Leave empty to use the team name">
          <input name="newClubName" maxLength={80} className={inputClass} />
        </Field>
      ) : null}
      <Field label="Logo link (optional)" hint="A full https:// link to a square image">
        <input name="logoUrl" type="url" defaultValue={team?.logoUrl ?? ""} maxLength={500} className={inputClass} />
      </Field>
      <FormMessage ok={state.ok} message={state.message} />
      <button type="submit" disabled={pending} className="h-12 w-full rounded-lg bg-gray-900 font-semibold text-white disabled:opacity-60">
        {pending ? "Saving…" : editing ? "Save changes" : "Add team"}
      </button>
    </form>
  );
}
