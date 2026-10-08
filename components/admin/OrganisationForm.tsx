"use client";

import { useActionState, useState } from "react";
import {
  createOrganisationAction,
  updateOrganisationAction,
  type OrgFormState,
} from "@/app/admin/(panel)/platform/actions";
import { slugify } from "@/lib/fixtures-paste/normalize";
import { Field, FormMessage, inputClass } from "./fields";

export type OrganisationFormValues = {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  tagline: string | null;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  facebook: string | null;
  hashtags: string[];
};

/** Create (with a link name) or edit an organisation's name and branding. */
export function OrganisationForm({ organisation }: { organisation?: OrganisationFormValues }) {
  const editing = Boolean(organisation);
  const [state, action, pending] = useActionState<OrgFormState, FormData>(
    editing ? updateOrganisationAction : createOrganisationAction,
    { ok: false, message: null },
  );
  const [name, setName] = useState(organisation?.name ?? "");
  const [slug, setSlug] = useState(organisation?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(false);
  const shownSlug = editing || slugTouched ? slug : slugify(name).slice(0, 40);

  return (
    <form action={action} className="space-y-3">
      {organisation ? <input type="hidden" name="orgId" value={organisation.id} /> : null}
      <Field label="Name" hint='In full, e.g. "Batho Pele Kasi Soccer Tournament"'>
        <input name="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} className={inputClass} />
      </Field>
      {editing ? (
        <p className="text-sm text-gray-600">
          Public link: <strong>/{organisation!.slug}</strong> (fixed, so shared links keep working)
        </p>
      ) : (
        <Field label="Link name" hint={`The public page will be /${shownSlug || "link-name"}. It can't be changed later.`}>
          <input
            name="slug"
            value={shownSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase());
            }}
            required
            maxLength={40}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            className={inputClass}
          />
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Short name" hint="For graphics">
          <input name="shortName" defaultValue={organisation?.shortName ?? ""} maxLength={30} className={inputClass} />
        </Field>
        <Field label="Tagline">
          <input name="tagline" defaultValue={organisation?.tagline ?? ""} maxLength={120} className={inputClass} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Main colour">
          <input
            name="primaryColor"
            type="color"
            defaultValue={organisation?.primaryColor ?? "#1F7A3F"}
            required
            className="mt-1 block h-12 w-full rounded-lg border border-black/20 bg-white p-1"
          />
        </Field>
        <Field label="Second colour">
          <input
            name="secondaryColor"
            type="color"
            defaultValue={organisation?.secondaryColor ?? "#F2C230"}
            required
            className="mt-1 block h-12 w-full rounded-lg border border-black/20 bg-white p-1"
          />
        </Field>
      </div>
      <Field label="Logo link (optional)" hint="A full https:// link to the logo image">
        <input name="logoUrl" defaultValue={organisation?.logoUrl ?? ""} maxLength={500} className={inputClass} />
      </Field>
      <Field label="Facebook page (optional)" hint="https://www.facebook.com/…">
        <input name="facebook" type="url" defaultValue={organisation?.facebook ?? ""} maxLength={500} className={inputClass} />
      </Field>
      <Field label="Hashtags (optional)" hint="Up to 6, e.g. #KasiSoccer #QwaQwa">
        <input name="hashtags" defaultValue={organisation?.hashtags.join(" ") ?? ""} maxLength={200} className={inputClass} />
      </Field>
      <FormMessage ok={state.ok} message={state.message} />
      <button type="submit" disabled={pending} className="h-12 w-full rounded-lg bg-gray-900 font-semibold text-white disabled:opacity-60">
        {pending ? "Saving…" : editing ? "Save changes" : "Create organisation"}
      </button>
    </form>
  );
}
