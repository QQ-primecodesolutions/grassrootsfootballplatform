"use client";

type Props = {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  size?: "lg" | "sm";
};

/** Big +/− control for scores: usable with one thumb, no keyboard needed. */
export function Stepper({ label, value, onChange, min = 0, max = 99, size = "lg" }: Props) {
  const btn =
    size === "lg"
      ? "h-14 w-14 text-3xl"
      : "h-11 w-11 text-2xl";
  const num = size === "lg" ? "w-14 text-5xl" : "w-10 text-3xl";
  return (
    <div className="flex items-center justify-center gap-2" role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`${label}: minus one`}
        className={`${btn} rounded-full bg-gray-200 font-bold text-gray-900 active:bg-gray-300 disabled:opacity-30`}
      >
        −
      </button>
      <output aria-live="polite" className={`${num} text-center font-display font-bold tabular-nums`}>
        {value}
      </output>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`${label}: plus one`}
        className={`${btn} rounded-full bg-gray-900 font-bold text-white active:bg-gray-700 disabled:opacity-30`}
      >
        +
      </button>
    </div>
  );
}
