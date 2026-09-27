"use client";

import { useActionState, useState } from "react";
import { createFixture, type FixtureFormState } from "@/app/admin/(panel)/fixtures/actions";
import { Field, FormMessage, VenuePicker, inputClass, type CompetitionOption, type VenueOption } from "./fields";

const initial: FixtureFormState = { ok: false, message: null, nonce: 0 };

/** Single fixture with an "add another" flow: competition, date, time, venue and round stay filled in. */
export function FixtureForm({ competitions, venues, today }: { competitions: CompetitionOption[]; venues: VenueOption[]; today: string }) {
  const [state, action, pending] = useActionState(createFixture, initial);
  const [competitionId, setCompetitionId] = useState(competitions[0]?.id ?? "");
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [venueId, setVenueId] = useState("");
  const [newVenue, setNewVenue] = useState("");
  const [round, setRound] = useState("");

  // After a successful save, clear only the teams (derived-state reset on a new result).
  const [seenNonce, setSeenNonce] = useState(state.nonce);
  if (state.nonce !== seenNonce) {
    setSeenNonce(state.nonce);
    if (state.ok) {
      setHome("");
      setAway("");
      if (venueId === "__new") setVenueId("");
    }
  }

  const entries = competitions.find((c) => c.id === competitionId)?.entries ?? [];

  return (
    <form action={action} className="space-y-4">
      <Field label="Competition">
        <select
          name="competitionId"
          value={competitionId}
          onChange={(e) => {
            setCompetitionId(e.target.value);
            setHome("");
            setAway("");
          }}
          className={inputClass}
        >
          {competitions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Home team">
          <select name="homeEntryId" value={home} onChange={(e) => setHome(e.target.value)} required className={inputClass}>
            <option value="">Choose…</option>
            {entries.map((e) => (
              <option key={e.entryId} value={e.entryId} disabled={e.entryId === away}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Away team">
          <select name="awayEntryId" value={away} onChange={(e) => setAway(e.target.value)} required className={inputClass}>
            <option value="">Choose…</option>
            {entries.map((e) => (
              <option key={e.entryId} value={e.entryId} disabled={e.entryId === home}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <input type="date" name="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
        </Field>
        <Field label="Kick-off" hint="Leave empty if not known yet">
          <input type="time" name="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} />
        </Field>
      </div>

      <VenuePicker venues={venues} venueId={venueId} newVenue={newVenue} onVenueId={setVenueId} onNewVenue={setNewVenue} />
      {/* The picker's "__new" sentinel is not a real id. */}
      {venueId === "__new" ? <input type="hidden" name="venueId" value="" /> : null}

      <Field label="Round" hint='e.g. "Round 8" or "Semi-final"'>
        <input name="roundLabel" value={round} onChange={(e) => setRound(e.target.value)} maxLength={40} className={inputClass} />
      </Field>

      <FormMessage ok={state.ok} message={state.message} />

      <button type="submit" disabled={pending} className="h-14 w-full rounded-lg bg-gray-900 text-base font-semibold text-white disabled:opacity-60">
        {pending ? "Saving…" : "Save fixture"}
      </button>
    </form>
  );
}
