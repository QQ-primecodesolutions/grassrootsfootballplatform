/**
 * All display and date logic runs in Africa/Johannesburg (SAST, UTC+02:00, no DST).
 * Store instants as UTC timestamptz; convert only at the edges via these helpers.
 */

export const TIME_ZONE = "Africa/Johannesburg";
const SAST_OFFSET = "+02:00";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Build an instant from a SAST calendar date ("2026-08-15") and optional time ("14:00"). */
export function sastDateTime(date: string, time = "00:00"): Date {
  if (!ISO_DATE.test(date)) throw new Error(`Invalid date "${date}", expected YYYY-MM-DD`);
  if (!HH_MM.test(time)) throw new Error(`Invalid time "${time}", expected HH:MM`);
  const d = new Date(`${date}T${time}:00${SAST_OFFSET}`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date "${date}"`);
  return d;
}

const dateKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** SAST calendar date of an instant, as YYYY-MM-DD. */
export function sastDateKey(instant: Date): string {
  return dateKeyFormat.format(instant);
}

/** Today's date in SAST, as YYYY-MM-DD. `now` is injectable for tests. */
export function todaySast(now: Date = new Date()): string {
  return sastDateKey(now);
}

const longDate = new Intl.DateTimeFormat("en-ZA", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const shortDate = new Intl.DateTimeFormat("en-ZA", {
  timeZone: TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
});

const timeOfDay = new Intl.DateTimeFormat("en-ZA", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "15 August 2026" */
export function formatLongDate(instant: Date): string {
  return longDate.format(instant);
}

/** "Sat, 15 Aug" */
export function formatShortDate(instant: Date): string {
  return shortDate.format(instant);
}

/** "14:00" */
export function formatTime(instant: Date): string {
  return timeOfDay.format(instant);
}
