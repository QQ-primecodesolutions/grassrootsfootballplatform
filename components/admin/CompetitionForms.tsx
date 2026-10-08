"use client";

import { useActionState, useState } from "react";
import {
  addAdjustmentAction,
  addSponsorAction,
  addEntriesAction,
  addNewTeamsAction,
  createCompetitionAction,
  updateCompetitionAction,
  updateRulesAction,
  updateSponsorLogoAction,
  type SetupFormState,
} from "@/app/admin/(panel)/competitions/actions";
import { COMPETITION_TYPE_LABELS } from "@/lib/competitions/input";
import { slugify } from "@/lib/fixtures-paste/normalize";
import { TIE_BREAKER_LABELS, TIE_BREAKERS, type CompetitionRules } from "@/lib/rules";
import { Field, FormMessage, inputClass } from "./fields";

const initial: SetupFormState = { ok: false, message: null, nonce: 0 };
const submitClass = "h-12 w-full rounded-lg bg-gray-900 font-semibold text-white disabled:opacity-60";

export type CompetitionSettings = {
  id: string;
  slug: string;
  name: string;
  type: "league" | "knockout" | "group_knockout" | "friendly";
  seasonName: string;
  streamLabel: string | null;
  area: string | null;
  slogan: string | null;
  logoUrl: string | null;
  facebook: string | null;
  expectedMatchCount: number | null;
  isFeatured: boolean;
};

/** New competition (type, season, link name) or edit an existing one's settings. */
export function CompetitionForm({
  competition,
  seasons = [],
  defaultSeason,
}: {
  competition?: CompetitionSettings;
  seasons?: string[];
  defaultSeason?: string;
}) {
  const editing = Boolean(competition);
  const [state, action, pending] = useActionState(editing ? updateCompetitionAction : createCompetitionAction, initial);
  const [name, setName] = useState(competition?.name ?? "");
  const [season, setSeason] = useState(defaultSeason ?? "");
  const [type, setType] = useState(competition?.type ?? "league");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const shownSlug = slugTouched ? slug : slugify(`${name} ${season}`).slice(0, 60);

  return (
    <form action={action} className="space-y-3">
      {competition ? <input type="hidden" name="competitionId" value={competition.id} /> : null}
      {editing ? (
        <p className="text-sm text-gray-600">
          {COMPETITION_TYPE_LABELS[competition!.type]} · season {competition!.seasonName} · link{" "}
          <strong>/{competition!.slug}</strong> (fixed, so shared links keep working)
        </p>
      ) : (
        <fieldset>
          <legend className="text-sm font-semibold">Format</legend>
          <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(
              [
                ["league", "League", "Everyone plays everyone; a table"],
                ["knockout", "Knockout / cup", "Rounds, a winner each match"],
                ["friendly", "Friendlies", "One-off matches; no table, draws allowed"],
              ] as const
            ).map(([value, label, hint]) => (
              <label
                key={value}
                className={`rounded-lg p-3 ring-1 ${type === value ? "bg-gray-900 text-white ring-gray-900" : "bg-white ring-black/15"}`}
              >
                <input
                  type="radio"
                  name="type"
                  value={value}
                  checked={type === value}
                  onChange={() => setType(value)}
                  className="sr-only"
                />
                <span className="block font-semibold">{label}</span>
                <span className="block text-xs opacity-80">{hint}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <Field label="Name" hint='e.g. "QwaQwa Development League Open", "Top 4 Cup" or "Friendlies"'>
        <input name="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} className={inputClass} />
      </Field>
      {editing ? null : (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Season" hint="e.g. 2026 or 2026/27">
            <input
              name="season"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              list="season-options"
              required
              maxLength={30}
              className={inputClass}
            />
            <datalist id="season-options">
              {seasons.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="Link name" hint="Fixed once created">
            <input
              name="slug"
              value={shownSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value.toLowerCase());
              }}
              required
              maxLength={60}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              className={inputClass}
            />
          </Field>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Stream / group (optional)" hint='e.g. "Stream A"'>
          <input name="streamLabel" defaultValue={competition?.streamLabel ?? ""} maxLength={40} className={inputClass} />
        </Field>
        <Field label="Area (optional)" hint='e.g. "Tseki"'>
          <input name="area" defaultValue={competition?.area ?? ""} maxLength={60} className={inputClass} />
        </Field>
      </div>
      {type === "league" ? (
        <Field label="Matches in the season (optional)" hint="Shows “X of N results entered”. 6 teams, home and away = 30.">
          <input
            name="expectedMatchCount"
            inputMode="numeric"
            defaultValue={competition?.expectedMatchCount ?? ""}
            maxLength={4}
            className={inputClass}
          />
        </Field>
      ) : null}
      <details className="rounded-lg bg-gray-50 p-3 ring-1 ring-black/5" open={editing}>
        <summary className="cursor-pointer text-sm font-semibold">Branding (optional)</summary>
        <div className="mt-3 space-y-3">
          <Field label="Slogan">
            <input name="slogan" defaultValue={competition?.slogan ?? ""} maxLength={120} className={inputClass} />
          </Field>
          <Field label="Logo link" hint="A full https:// link to the competition's logo">
            <input name="logoUrl" defaultValue={competition?.logoUrl ?? ""} maxLength={500} className={inputClass} />
          </Field>
          <Field label="Facebook page" hint="https://www.facebook.com/…">
            <input name="facebook" type="url" defaultValue={competition?.facebook ?? ""} maxLength={500} className={inputClass} />
          </Field>
        </div>
      </details>
      <label className="flex items-start gap-3 rounded-lg bg-white p-3 ring-1 ring-black/10">
        <input type="checkbox" name="isFeatured" defaultChecked={competition?.isFeatured ?? false} className="mt-1 h-5 w-5" />
        <span>
          <span className="block font-semibold">Feature on the public home page</span>
          <span className="block text-xs text-gray-600">Only one competition is featured at a time.</span>
        </span>
      </label>
      <FormMessage ok={state.ok} message={state.message} />
      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? "Saving…" : editing ? "Save settings" : "Create competition"}
      </button>
    </form>
  );
}

/** Points, tie-breaker order and walkover score, plus "confirmed by the organiser". */
export function RulesForm({ competitionId, rules }: { competitionId: string; rules: CompetitionRules }) {
  const [state, action, pending] = useActionState(updateRulesAction, initial);
  const after = rules.tieBreakers.slice(1);
  const options = TIE_BREAKERS.filter((t) => t !== "points");
  const num = (name: string, label: string, value: number) => (
    <Field label={label}>
      <input name={name} inputMode="numeric" defaultValue={value} required maxLength={2} className={inputClass} />
    </Field>
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="competitionId" value={competitionId} />
      <div className="grid grid-cols-3 gap-2">
        {num("win", "Win", rules.points.win)}
        {num("draw", "Draw", rules.points.draw)}
        {num("loss", "Loss", rules.points.loss)}
      </div>
      <fieldset>
        <legend className="text-sm font-semibold">When teams are level on points, separate them by</legend>
        <ol className="mt-1 space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="w-5 text-right text-sm font-semibold">{i + 1}.</span>
              <select name={`tb${i + 1}`} defaultValue={after[i] ?? ""} className={`${inputClass} mt-0`}>
                <option value="">(nothing more)</option>
                {options.map((t) => (
                  <option key={t} value={t}>
                    {TIE_BREAKER_LABELS[t]}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ol>
      </fieldset>
      <div className="grid grid-cols-2 gap-2">
        {num("walkoverFor", "Walkover: winner's goals", rules.walkover.score[0])}
        {num("walkoverAgainst", "Walkover: loser's goals", rules.walkover.score[1])}
      </div>
      <label className="flex items-center gap-3">
        <input type="checkbox" name="walkoverCountGoals" defaultChecked={rules.walkover.countGoals} className="h-5 w-5" />
        <span className="text-sm">Walkover goals count towards goal difference and goals scored</span>
      </label>
      <label className="flex items-start gap-3 rounded-lg bg-amber-50 p-3 ring-1 ring-amber-200">
        <input type="checkbox" name="confirmed" defaultChecked={rules.confirmed} className="mt-1 h-5 w-5" />
        <span className="text-sm">
          <span className="block font-semibold">The organiser has confirmed these rules</span>
          Leave unticked until they have. The admin home keeps reminding you until then.
        </span>
      </label>
      <FormMessage ok={state.ok} message={state.message} />
      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? "Saving…" : "Save rules"}
      </button>
    </form>
  );
}

/** Tick existing teams to enter them. */
export function AddExistingTeamsForm({
  competitionId,
  teams,
}: {
  competitionId: string;
  teams: { id: string; name: string; category: string }[];
}) {
  const [state, action, pending] = useActionState(addEntriesAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="competitionId" value={competitionId} />
      {teams.length ? null : <p className="text-sm text-gray-600">All of your teams are already in this competition.</p>}
      <ul hidden={!teams.length} className="max-h-72 space-y-1 overflow-y-auto rounded-lg bg-gray-50 p-2 ring-1 ring-black/5">
        {teams.map((t) => (
          <li key={t.id}>
            <label className="flex items-center gap-3 rounded px-2 py-2 hover:bg-white">
              <input type="checkbox" name="teamId" value={t.id} className="h-5 w-5" />
              <span className="min-w-0 flex-1 truncate">{t.name}</span>
              <span className="text-xs text-gray-600">{t.category}</span>
            </label>
          </li>
        ))}
      </ul>
      <FormMessage ok={state.ok} message={state.message} />
      <button type="submit" disabled={pending || !teams.length} className={submitClass}>
        {pending ? "Adding…" : "Add ticked teams"}
      </button>
    </form>
  );
}

/** Paste or type new team names, one per line; they're created and entered. */
export function AddNewTeamsForm({ competitionId }: { competitionId: string }) {
  const [state, action, pending] = useActionState(addNewTeamsAction, initial);
  const [names, setNames] = useState("");
  const [seenNonce, setSeenNonce] = useState(state.nonce);
  if (state.nonce !== seenNonce) {
    setSeenNonce(state.nonce);
    if (state.ok) setNames("");
  }
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="competitionId" value={competitionId} />
      <Field label="Team names" hint="One per line (or paste the list from WhatsApp). Numbers and bullets are removed.">
        <textarea
          name="names"
          value={names}
          onChange={(e) => setNames(e.target.value)}
          rows={6}
          maxLength={5000}
          className={inputClass}
          placeholder={"Passion FC\nSamba Boys\nTseki Galaxy"}
        />
      </Field>
      <Field label="Category">
        <input name="category" defaultValue="Open" list="setup-categories" required maxLength={20} className={inputClass} />
        <datalist id="setup-categories">
          {["Open", "U13", "U15", "U17", "U19", "U21", "Veterans"].map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <FormMessage ok={state.ok} message={state.message} />
      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? "Adding…" : "Create and add teams"}
      </button>
    </form>
  );
}

export function AdjustmentForm({
  competitionId,
  entries,
  today,
}: {
  competitionId: string;
  entries: { entryId: string; name: string }[];
  today: string;
}) {
  const [state, action, pending] = useActionState(addAdjustmentAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="competitionId" value={competitionId} />
      <Field label="Team">
        <select name="entryId" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Choose…
          </option>
          {entries.map((e) => (
            <option key={e.entryId} value={e.entryId}>
              {e.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Points" hint="e.g. -3 (deduction) or 3">
          <input name="points" inputMode="text" required maxLength={4} className={inputClass} />
        </Field>
        <Field label="Applies from">
          <input name="effectiveOn" type="date" defaultValue={today} required className={inputClass} />
        </Field>
      </div>
      <Field label="Reason" hint="As the organiser announced it">
        <input name="reason" required maxLength={200} className={inputClass} />
      </Field>
      <FormMessage ok={state.ok} message={state.message} />
      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? "Saving…" : "Add adjustment"}
      </button>
    </form>
  );
}

/** Add a sponsor to the competition's graphics: an existing one, or a new name (+ optional logo). */
export function AddSponsorForm({
  competitionId,
  available,
}: {
  competitionId: string;
  available: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(addSponsorAction, initial);
  const [choice, setChoice] = useState(available.length ? "" : "__new");
  const isNew = choice === "__new" || !available.length;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="competitionId" value={competitionId} />
      {available.length ? (
        <Field label="Sponsor">
          <select name="sponsorId" value={choice} onChange={(e) => setChoice(e.target.value)} required className={inputClass}>
            <option value="" disabled>
              Choose…
            </option>
            {available.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value="__new">+ New sponsor…</option>
          </select>
        </Field>
      ) : (
        <input type="hidden" name="sponsorId" value="__new" />
      )}
      {isNew ? (
        <>
          <Field label="Sponsor name" hint="As it should appear on graphics">
            <input name="name" required maxLength={60} className={inputClass} />
          </Field>
          <Field label="Logo link (optional)" hint="A full https:// link. Without one, the name is shown.">
            <input name="logoUrl" maxLength={500} className={inputClass} />
          </Field>
        </>
      ) : null}
      <FormMessage ok={state.ok} message={state.message} />
      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? "Adding…" : "Add sponsor"}
      </button>
    </form>
  );
}

/** Change or remove one sponsor's logo link. */
export function SponsorLogoForm({
  competitionId,
  sponsorId,
  logoUrl,
}: {
  competitionId: string;
  sponsorId: string;
  logoUrl: string | null;
}) {
  const [state, action, pending] = useActionState(updateSponsorLogoAction, initial);
  return (
    <form action={action} className="mt-2 space-y-2">
      <input type="hidden" name="competitionId" value={competitionId} />
      <input type="hidden" name="sponsorId" value={sponsorId} />
      <Field label="Logo link" hint="Leave empty to show the name. Used on every competition with this sponsor.">
        <input name="logoUrl" defaultValue={logoUrl ?? ""} maxLength={500} className={inputClass} />
      </Field>
      <FormMessage ok={state.ok} message={state.message} />
      <button type="submit" disabled={pending} className="h-11 w-full rounded-lg bg-white font-semibold ring-1 ring-black/15 disabled:opacity-60">
        {pending ? "Saving…" : "Save logo"}
      </button>
    </form>
  );
}
