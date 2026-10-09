"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { savePastedFixtures, type FixtureFormState } from "@/app/admin/(panel)/fixtures/actions";
import { matchTeamName, type NameMatch } from "@/lib/fixtures-paste/match";
import { parseFixtureText } from "@/lib/fixtures-paste/parse";
import { Field, FormMessage, StageField, VenuePicker, inputClass, type CompetitionOption, type VenueOption } from "./fields";

type Side = "home" | "away";
type Override = { entryId: string; learn: boolean };

const initial: FixtureFormState = { ok: false, message: null, nonce: 0 };

const EXAMPLE = `Passion FC vs Samba Boys
14:00 Tseki Jnr Stars v Remember Matoota
Lere La Tshepe vs Tseki Galaxy`;

export function PasteFixtures({ competitions, venues, today }: { competitions: CompetitionOption[]; venues: VenueOption[]; today: string }) {
  const [state, action, pending] = useActionState(savePastedFixtures, initial);
  const [competitionId, setCompetitionId] = useState(competitions[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [venueId, setVenueId] = useState("");
  const [newVenue, setNewVenue] = useState("");
  const [round, setRound] = useState("");
  const [stage, setStage] = useState<"group" | "knockout">("group");
  const [text, setText] = useState("");
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [excluded, setExcluded] = useState<Record<number, boolean>>({});

  // Clear the paste box after a successful save (derived-state reset).
  const [seenNonce, setSeenNonce] = useState(state.nonce);
  if (state.nonce !== seenNonce) {
    setSeenNonce(state.nonce);
    if (state.ok) {
      setText("");
      setOverrides({});
      setExcluded({});
    }
  }

  const competition = competitions.find((c) => c.id === competitionId);
  const entries = useMemo(() => competition?.entries ?? [], [competition]);
  const nameOf = (id: string) => entries.find((e) => e.entryId === id)?.name ?? "?";

  const rows = useMemo(() => {
    const { fixtures, ignored } = parseFixtureText(text);
    const candidates = entries.map((e) => ({ entryId: e.entryId, name: e.name, aliases: e.aliases }));
    const parsed = fixtures.map((f) => {
      const resolve = (side: Side, name: string): { match: NameMatch; entryId: string | null; override?: Override } => {
        const match = matchTeamName(name, candidates);
        const override = overrides[`${f.lineNo}:${side}`];
        const entryId = override?.entryId || (match.status === "matched" ? match.entryId : null);
        return { match, entryId, override };
      };
      return { ...f, homeRes: resolve("home", f.home), awayRes: resolve("away", f.away) };
    });
    const seen = new Set<string>();
    const withProblems = parsed.map((r) => {
      let problem: string | null = null;
      if (!r.homeRes.entryId || !r.awayRes.entryId) problem = "Pick the team(s) highlighted in red";
      else if (r.homeRes.entryId === r.awayRes.entryId) problem = "A team can't play itself";
      else {
        const key = `${r.homeRes.entryId}-${r.awayRes.entryId}`;
        if (seen.has(key)) problem = "Duplicate line";
        seen.add(key);
      }
      return { ...r, problem };
    });
    return { rows: withProblems, ignored };
  }, [text, entries, overrides]);

  const included = rows.rows.filter((r) => !excluded[r.lineNo]);
  const blocking = included.filter((r) => r.problem);
  const payload = {
    competitionId,
    date,
    time: time || undefined,
    venueId: venueId && venueId !== "__new" ? venueId : undefined,
    newVenue: venueId === "__new" ? newVenue : undefined,
    roundLabel: round || undefined,
    stage: competition?.type === "group_knockout" ? stage : undefined,
    fixtures: included
      .filter((r) => !r.problem)
      .map((r) => ({ homeEntryId: r.homeRes.entryId!, awayEntryId: r.awayRes.entryId!, time: r.time })),
    aliases: included.flatMap((r) =>
      (["home", "away"] as const).flatMap((side) => {
        const res = side === "home" ? r.homeRes : r.awayRes;
        const typed = side === "home" ? r.home : r.away;
        const teamId = entries.find((e) => e.entryId === res.override?.entryId)?.teamId;
        return res.override?.learn && teamId ? [{ teamId, alias: typed }] : [];
      }),
    ),
  };

  const setOverride = (lineNo: number, side: Side, patch: Partial<Override>) =>
    setOverrides((o) => {
      const key = `${lineNo}:${side}`;
      const current = o[key] ?? { entryId: "", learn: true };
      return { ...o, [key]: { ...current, ...patch } };
    });

  const teamCell = (r: (typeof rows.rows)[number], side: Side) => {
    const res = side === "home" ? r.homeRes : r.awayRes;
    const typed = side === "home" ? r.home : r.away;
    const auto = res.match.status === "matched" && !res.override?.entryId;
    if (auto) {
      return (
        <span className="block rounded bg-green-50 px-2 py-1 text-sm font-semibold text-green-900 ring-1 ring-green-200">
          {nameOf(res.entryId!)}
        </span>
      );
    }
    const suggestions =
      res.match.status === "unmatched" ? res.match.suggestions : res.match.status === "ambiguous" ? res.match.options : [];
    return (
      <div className="rounded bg-red-50 p-1.5 ring-1 ring-red-300">
        <p className="text-xs text-red-800">
          “{typed}” {res.match.status === "ambiguous" ? "fits more than one team" : "not recognised"}
        </p>
        <select
          aria-label={`Team for “${typed}”`}
          value={res.override?.entryId ?? ""}
          onChange={(e) => setOverride(r.lineNo, side, { entryId: e.target.value })}
          className="mt-1 block w-full rounded border border-black/20 bg-white px-2 py-2 text-sm"
        >
          <option value="">Choose…</option>
          {suggestions.length ? (
            <optgroup label="Suggested">
              {suggestions.map((id) => (
                <option key={`s-${id}`} value={id}>
                  {nameOf(id)}
                </option>
              ))}
            </optgroup>
          ) : null}
          <optgroup label="All teams">
            {entries.map((e) => (
              <option key={e.entryId} value={e.entryId}>
                {e.name}
              </option>
            ))}
          </optgroup>
        </select>
        {res.override?.entryId ? (
          <label className="mt-1 flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={res.override.learn}
              onChange={(e) => setOverride(r.lineNo, side, { learn: e.target.checked })}
            />
            Remember “{typed}” for next time
          </label>
        ) : null}
      </div>
    );
  };

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />

      <Field label="Competition">
        <select
          value={competitionId}
          onChange={(e) => {
            setCompetitionId(e.target.value);
            setOverrides({});
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
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={inputClass} />
        </Field>
        <Field label="Default kick-off" hint="Times on a line win">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} />
        </Field>
      </div>
      <VenuePicker venues={venues} venueId={venueId} newVenue={newVenue} onVenueId={setVenueId} onNewVenue={setNewVenue} />
      {competition?.type === "group_knockout" ? <StageField value={stage} onChange={setStage} /> : null}
      <Field label="Round" hint='e.g. "Round 8"'>
        <input value={round} onChange={(e) => setRound(e.target.value)} maxLength={40} className={inputClass} />
      </Field>

      <Field label="Paste fixtures" hint="One per line, e.g. “Passion FC vs Samba Boys”. Numbering, emoji and times are fine.">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={EXAMPLE}
          className={`${inputClass} font-mono text-sm`}
        />
      </Field>

      {rows.rows.length ? (
        <section aria-label="Preview" className="space-y-2">
          <h2 className="font-display text-lg font-bold uppercase">Preview</h2>
          <ul className="space-y-2">
            {rows.rows.map((r) => (
              <li
                key={r.lineNo}
                className={`rounded-lg bg-white p-3 shadow-sm ring-1 ${excluded[r.lineNo] ? "opacity-50 ring-black/5" : r.problem ? "ring-red-300" : "ring-black/5"}`}
              >
                <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                  <span>
                    Line {r.lineNo}
                    {r.time ? ` · ${r.time}` : ""}
                  </span>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={!excluded[r.lineNo]}
                      onChange={(e) => setExcluded((x) => ({ ...x, [r.lineNo]: !e.target.checked }))}
                    />
                    Include
                  </label>
                </div>
                <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-start gap-2">
                  {teamCell(r, "home")}
                  <span className="pt-1 text-sm font-bold text-gray-500">v</span>
                  {teamCell(r, "away")}
                </div>
                {r.problem && !excluded[r.lineNo] ? <p className="mt-1 text-xs font-semibold text-red-700">{r.problem}</p> : null}
              </li>
            ))}
          </ul>
          {rows.ignored.length ? (
            <p className="text-xs text-gray-600">
              Ignored {rows.ignored.length} line{rows.ignored.length === 1 ? "" : "s"} without “vs”: {rows.ignored.map((i) => `“${i.raw.trim()}”`).join(", ")}
            </p>
          ) : null}
        </section>
      ) : null}

      <FormMessage ok={state.ok} message={state.message} />
      {state.ok && state.shareHref ? (
        <Link
          href={state.shareHref}
          className="flex h-12 items-center justify-center rounded-lg bg-sky-50 font-semibold text-sky-950 ring-1 ring-sky-200"
        >
          Share these fixtures (graphic + WhatsApp) →
        </Link>
      ) : null}

      <button
        type="submit"
        disabled={pending || payload.fixtures.length === 0 || blocking.length > 0}
        className="h-14 w-full rounded-lg bg-gray-900 text-base font-semibold text-white disabled:opacity-50"
      >
        {pending
          ? "Saving…"
          : blocking.length
            ? `Fix ${blocking.length} line${blocking.length === 1 ? "" : "s"} first`
            : `Save ${payload.fixtures.length} fixture${payload.fixtures.length === 1 ? "" : "s"}`}
      </button>
    </form>
  );
}
