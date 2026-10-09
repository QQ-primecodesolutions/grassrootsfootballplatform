"use client";

import { useActionState, useState } from "react";
import { saveResult, type SaveResultState } from "@/app/admin/(panel)/results/actions";
import { Stepper } from "./Stepper";

type Status = "scheduled" | "postponed" | "cancelled" | "abandoned" | "completed";
type Outcome = "normal" | "walkover" | "awarded";

export type ResultFormMatch = {
  id: string;
  competitionType: "league" | "knockout" | "group_knockout" | "friendly";
  homeName: string;
  awayName: string;
  status: Status;
  outcomeType: Outcome;
  resultState: "provisional" | "confirmed";
  homeGoals: number | null;
  awayGoals: number | null;
  htHomeGoals: number | null;
  htAwayGoals: number | null;
  aetHomeGoals: number | null;
  aetAwayGoals: number | null;
  penHome: number | null;
  penAway: number | null;
  walkoverWinner: "home" | "away" | null;
  notes: string | null;
};

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "completed", label: "Played" },
  { value: "postponed", label: "Postponed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "abandoned", label: "Abandoned" },
  { value: "scheduled", label: "Not played yet" },
];

const OUTCOME_OPTIONS: { value: Outcome; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "walkover", label: "Walkover" },
  { value: "awarded", label: "Awarded" },
];

function Segmented<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-1 rounded-lg bg-gray-200 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 flex-1 rounded-md px-2 text-sm font-semibold ${
            value === o.value ? "bg-white shadow-sm" : "text-gray-700"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const initialState: SaveResultState = { ok: false, message: null, errors: {} };

/**
 * `canPublish` is false for scorers: they enter the score of a played match only, and it
 * stays provisional until an organisation admin publishes it (enforced again on the server).
 */
export function ResultForm({ match, canPublish = true }: { match: ResultFormMatch; canPublish?: boolean }) {
  const [state, formAction, pending] = useActionState(saveResult, initialState);
  const extrasAllowed = match.competitionType !== "league";
  // Friendlies may end level: a shootout is optional there, but required in knockouts.
  const friendly = match.competitionType === "friendly";

  const [status, setStatus] = useState<Status>(!canPublish || match.status === "scheduled" ? "completed" : match.status);
  const [outcome, setOutcome] = useState<Outcome>(match.outcomeType);
  const [home, setHome] = useState(match.homeGoals ?? 0);
  const [away, setAway] = useState(match.awayGoals ?? 0);
  const [showHt, setShowHt] = useState(match.htHomeGoals !== null);
  const [htHome, setHtHome] = useState(match.htHomeGoals ?? 0);
  const [htAway, setHtAway] = useState(match.htAwayGoals ?? 0);
  const [showEt, setShowEt] = useState(match.aetHomeGoals !== null);
  const [aetHome, setAetHome] = useState(match.aetHomeGoals ?? match.homeGoals ?? 0);
  const [aetAway, setAetAway] = useState(match.aetAwayGoals ?? match.awayGoals ?? 0);
  const [penHome, setPenHome] = useState(match.penHome ?? 0);
  const [penAway, setPenAway] = useState(match.penAway ?? 0);
  const [showPens, setShowPens] = useState(match.penHome !== null);
  const [walkoverWinner, setWalkoverWinner] = useState<"home" | "away" | null>(match.walkoverWinner);
  const [confirming, setConfirming] = useState(false);

  // Each completed save returns a new state object: leave the "Yes, publish" step.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    setConfirming(false);
  }

  const played = status === "completed";
  const scored = played && outcome !== "walkover";
  // Extra time and penalties only exist outside leagues, and only after a draw.
  const etAvailable = scored && extrasAllowed && home === away;
  const finalHome = etAvailable && showEt ? aetHome : home;
  const finalAway = etAvailable && showEt ? aetAway : away;
  const pensPossible = etAvailable && finalHome === finalAway;
  const pensNeeded = pensPossible && (!friendly || showPens);

  const scoreText =
    outcome === "walkover"
      ? `walkover to ${walkoverWinner === "home" ? match.homeName : walkoverWinner === "away" ? match.awayName : "…"}`
      : `${match.homeName} ${finalHome}–${finalAway} ${match.awayName}${pensNeeded ? ` (pens ${penHome}–${penAway})` : ""}`;

  const errors = state.errors;
  const fieldError = (msg?: string) =>
    msg ? (
      <p role="alert" className="mt-1 text-sm font-semibold text-red-700">
        {msg}
      </p>
    ) : null;

  return (
    <form action={formAction} className="space-y-5" onChange={() => setConfirming(false)}>
      <input type="hidden" name="matchId" value={match.id} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="outcome" value={played ? outcome : "normal"} />
      {scored ? (
        <>
          <input type="hidden" name="homeGoals" value={home} />
          <input type="hidden" name="awayGoals" value={away} />
          {showHt ? (
            <>
              <input type="hidden" name="htHome" value={htHome} />
              <input type="hidden" name="htAway" value={htAway} />
            </>
          ) : null}
          {etAvailable && showEt ? (
            <>
              <input type="hidden" name="aetHome" value={aetHome} />
              <input type="hidden" name="aetAway" value={aetAway} />
            </>
          ) : null}
          {pensNeeded ? (
            <>
              <input type="hidden" name="penHome" value={penHome} />
              <input type="hidden" name="penAway" value={penAway} />
            </>
          ) : null}
        </>
      ) : null}
      {played && outcome === "walkover" && walkoverWinner ? (
        <input type="hidden" name="walkoverWinner" value={walkoverWinner} />
      ) : null}

      {canPublish ? (
        <Segmented name="Match status" value={status} options={STATUS_OPTIONS} onChange={(v) => { setStatus(v); setConfirming(false); }} />
      ) : null}

      {played ? (
        <Segmented name="Outcome" value={outcome} options={OUTCOME_OPTIONS} onChange={(v) => { setOutcome(v); setConfirming(false); }} />
      ) : null}

      {scored ? (
        <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-black/5" aria-label="Full-time score">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div>
              <p className="mb-2 line-clamp-2 min-h-10 font-semibold leading-tight">{match.homeName}</p>
              <Stepper label={`${match.homeName} goals`} value={home} onChange={(n) => { setHome(n); setConfirming(false); }} />
            </div>
            <div>
              <p className="mb-2 line-clamp-2 min-h-10 font-semibold leading-tight">{match.awayName}</p>
              <Stepper label={`${match.awayName} goals`} value={away} onChange={(n) => { setAway(n); setConfirming(false); }} />
            </div>
          </div>
          {outcome === "awarded" ? (
            <p className="mt-3 text-center text-sm text-gray-600">Enter the score the organisers awarded.</p>
          ) : null}
          {fieldError(errors.score)}

          <div className="mt-4 border-t border-black/5 pt-3">
            <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={showHt} onChange={(e) => setShowHt(e.target.checked)} className="h-5 w-5" />
              Add half-time score
            </label>
            {showHt ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Stepper size="sm" label="Half-time home goals" value={htHome} max={home} onChange={setHtHome} />
                <Stepper size="sm" label="Half-time away goals" value={htAway} max={away} onChange={setHtAway} />
              </div>
            ) : null}
            {fieldError(errors.halfTime)}
          </div>

          {etAvailable ? (
            <div className="mt-3 border-t border-black/5 pt-3">
              <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={showEt} onChange={(e) => setShowEt(e.target.checked)} className="h-5 w-5" />
                Extra time was played
              </label>
              {showEt ? (
                <>
                  <p className="text-xs text-gray-600">Score after extra time (including the 90-minute goals).</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Stepper size="sm" label="Home goals after extra time" value={aetHome} min={home} onChange={setAetHome} />
                    <Stepper size="sm" label="Away goals after extra time" value={aetAway} min={away} onChange={setAetAway} />
                  </div>
                </>
              ) : null}
              {fieldError(errors.extraTime)}
            </div>
          ) : null}

          {pensPossible && friendly ? (
            <div className="mt-3 border-t border-black/5 pt-3">
              <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={showPens} onChange={(e) => setShowPens(e.target.checked)} className="h-5 w-5" />
                A penalty shootout was taken
              </label>
              <p className="text-xs text-gray-600">Leave unticked if the friendly ended as a draw.</p>
            </div>
          ) : null}

          {pensNeeded ? (
            <div className="mt-3 border-t border-black/5 pt-3">
              <p className="text-sm font-semibold">Penalty shootout (never counts as goals)</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Stepper size="sm" label="Home penalties" value={penHome} onChange={setPenHome} />
                <Stepper size="sm" label="Away penalties" value={penAway} onChange={setPenAway} />
              </div>
              {fieldError(errors.penalties)}
            </div>
          ) : null}
        </section>
      ) : null}

      {played && outcome === "walkover" ? (
        <section aria-label="Walkover winner" className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-black/5">
          <p className="mb-2 text-sm font-semibold">Who gets the walkover?</p>
          <div className="grid grid-cols-2 gap-2">
            {(["home", "away"] as const).map((side) => (
              <button
                key={side}
                type="button"
                aria-pressed={walkoverWinner === side}
                onClick={() => { setWalkoverWinner(side); setConfirming(false); }}
                className={`min-h-14 rounded-lg px-2 font-semibold ${
                  walkoverWinner === side ? "bg-gray-900 text-white" : "bg-gray-100"
                }`}
              >
                {side === "home" ? match.homeName : match.awayName}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-600">The table applies the competition&apos;s walkover score.</p>
          {fieldError(errors.walkover)}
        </section>
      ) : null}

      <details className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-black/5" open={Boolean(match.notes)}>
        <summary className="cursor-pointer text-sm font-semibold">Public note (optional)</summary>
        <textarea
          name="notes"
          defaultValue={match.notes ?? ""}
          maxLength={500}
          rows={2}
          placeholder="e.g. Kick-off delayed by rain"
          className="mt-2 block w-full rounded border border-black/20 p-2 text-base"
        />
        <p className="mt-1 text-xs text-gray-600">Shown on the public match page.</p>
      </details>

      {state.message ? (
        <p
          role="status"
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            state.ok ? "bg-green-50 text-green-900 ring-1 ring-green-200" : "bg-red-50 text-red-800 ring-1 ring-red-200"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <div className="sticky bottom-16 z-10 -mx-4 space-y-2 bg-gray-100/95 px-4 py-3 backdrop-blur">
        {!canPublish ? (
          <button
            type="submit"
            name="intent"
            value="provisional"
            disabled={pending}
            className="h-14 w-full rounded-lg bg-gray-900 text-base font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Sending…" : "Send score for confirmation"}
          </button>
        ) : !played ? (
          <button
            type="submit"
            name="intent"
            value="provisional"
            disabled={pending}
            className="h-14 w-full rounded-lg bg-gray-900 text-base font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Saving…" : `Save as ${STATUS_OPTIONS.find((s) => s.value === status)?.label.toLowerCase()}`}
          </button>
        ) : confirming ? (
          <>
            <button
              type="submit"
              name="intent"
              value="confirm"
              disabled={pending}
              className="h-14 w-full rounded-lg bg-green-700 text-base font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Publishing…" : `Yes, publish ${scoreText}`}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="h-11 w-full rounded-lg text-sm font-semibold text-gray-700"
            >
              Cancel
            </button>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="submit"
              name="intent"
              value="provisional"
              disabled={pending}
              className="h-14 rounded-lg bg-white text-base font-semibold ring-1 ring-black/15 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save provisional"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={pending}
              className="h-14 rounded-lg bg-gray-900 text-base font-semibold text-white disabled:opacity-60"
            >
              Confirm &amp; publish
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
