import Link from "next/link";
import type { TableRow } from "@/lib/public/views";
import { FormChips } from "./FormChips";

type Props = {
  orgSlug: string;
  rows: TableRow[];
  /** compact: Pos, Team, GP, GD, Pts (org home). full: every column + form. */
  variant?: "full" | "compact";
  caption?: string;
};

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

export function StandingsTable({ orgSlug, rows, variant = "full", caption }: Props) {
  const full = variant === "full";
  const th = "px-1.5 py-2 text-center font-semibold";
  const td = "px-1.5 py-2.5 text-center tabular-nums";
  return (
    // Horizontal scroll stays inside this container; the page itself never scrolls sideways.
    <div className="overflow-x-auto rounded-lg bg-surface shadow-sm ring-1 ring-black/5">
      <table className="w-full border-collapse text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="bg-brand text-on-brand font-display text-xs uppercase tracking-wide">
          <tr>
            <th scope="col" className={`${th} sticky left-0 z-10 w-10 bg-brand`}>
              Pos
            </th>
            <th scope="col" className="sticky left-10 z-10 bg-brand px-2 py-2 text-left font-semibold">
              Team
            </th>
            <th scope="col" className={th} title="Games played">
              GP
            </th>
            {full ? (
              <>
                <th scope="col" className={th} title="Won">W</th>
                <th scope="col" className={th} title="Drawn">D</th>
                <th scope="col" className={th} title="Lost">L</th>
                <th scope="col" className={th} title="Goals for">GF</th>
                <th scope="col" className={th} title="Goals against">GA</th>
              </>
            ) : null}
            <th scope="col" className={th} title="Goal difference">GD</th>
            {/* Points stay pinned to the right edge while the middle columns scroll. */}
            <th scope="col" className={`${th} sticky right-0 z-10 bg-brand`} title="Points">
              Pts
            </th>
            {full ? <th scope="col" className={`${th} text-left`}>Form</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.entryId} className="border-t border-black/5">
              <td className="sticky left-0 z-10 w-10 bg-surface px-1.5 py-1.5">
                <span className="flex h-8 w-8 items-center justify-center rounded bg-brand font-display text-base font-bold text-on-brand">
                  {r.tied ? `${r.position}=` : r.position}
                </span>
              </td>
              <th
                scope="row"
                className="sticky left-10 z-10 max-w-[8.5rem] bg-surface px-2 py-2.5 text-left font-semibold"
              >
                <Link href={`/${orgSlug}/team/${r.team.slug}`} className="block truncate hover:underline">
                  {r.name}
                </Link>
                {r.adjustment !== 0 ? (
                  <span className="block text-xs font-normal text-negative">
                    {r.adjustment > 0 ? "+" : "−"}
                    {Math.abs(r.adjustment)} pts adjustment
                  </span>
                ) : null}
              </th>
              <td className={td}>{r.played}</td>
              {full ? (
                <>
                  <td className={td}>{r.won}</td>
                  <td className={td}>{r.drawn}</td>
                  <td className={td}>{r.lost}</td>
                  <td className={td}>{r.goalsFor}</td>
                  <td className={td}>{r.goalsAgainst}</td>
                </>
              ) : null}
              <td
                className={`${td} font-semibold ${r.goalDifference > 0 ? "text-positive" : r.goalDifference < 0 ? "text-negative" : ""}`}
              >
                {signed(r.goalDifference)}
              </td>
              <td className="sticky right-0 z-10 bg-surface px-1.5 py-1.5 text-center shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.25)]">
                <span className="inline-flex h-8 min-w-8 items-center justify-center rounded bg-brand px-1.5 font-display text-base font-bold tabular-nums text-on-brand">
                  {r.points}
                </span>
              </td>
              {full ? (
                <td className="px-2 py-2">
                  <FormChips form={r.form} />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
