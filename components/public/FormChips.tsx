import type { FormResult } from "@/lib/standings";

const STYLE: Record<FormResult, string> = {
  W: "bg-positive text-white",
  D: "bg-gray-400 text-white",
  L: "bg-negative text-white",
};
const LABEL: Record<FormResult, string> = { W: "Won", D: "Drawn", L: "Lost" };

/** Last results, most recent last. */
export function FormChips({ form }: { form: FormResult[] }) {
  if (form.length === 0) return <span className="text-xs text-muted">–</span>;
  return (
    <span className="flex gap-0.5" aria-label={`Form, oldest to newest: ${form.map((f) => LABEL[f]).join(", ")}`}>
      {form.map((f, i) => (
        <span
          key={i}
          aria-hidden
          className={`flex h-5 w-5 items-center justify-center rounded-sm text-[0.65rem] font-bold ${STYLE[f]}`}
        >
          {f}
        </span>
      ))}
    </span>
  );
}
