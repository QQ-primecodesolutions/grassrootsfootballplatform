import { STATE_LABEL, type DisplayState } from "@/lib/match/public";

const STYLE: Record<DisplayState, string> = {
  final: "bg-brand text-on-brand",
  pending: "bg-amber-100 text-amber-900 ring-1 ring-amber-300",
  scheduled: "bg-black/5 text-ink",
  postponed: "bg-orange-100 text-orange-900 ring-1 ring-orange-300",
  cancelled: "bg-gray-200 text-gray-700 line-through",
  abandoned: "bg-red-100 text-red-900 ring-1 ring-red-300",
};

export function StatusBadge({ state, className = "" }: { state: DisplayState; className?: string }) {
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide ${STYLE[state]} ${className}`}
    >
      {STATE_LABEL[state]}
    </span>
  );
}
