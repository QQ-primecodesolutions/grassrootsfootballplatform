/** Shared admin form bits: labelled fields with large touch targets. */

export const inputClass = "mt-1 block w-full rounded-lg border border-black/20 bg-white px-3 py-3 text-base";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-gray-600">{hint}</span> : null}
    </label>
  );
}

export function FormMessage({ ok, message }: { ok: boolean; message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className={`rounded-lg px-3 py-2 text-sm font-semibold ${
        ok ? "bg-green-50 text-green-900 ring-1 ring-green-200" : "bg-red-50 text-red-800 ring-1 ring-red-200"
      }`}
    >
      {message}
    </p>
  );
}

export type CompetitionOption = {
  id: string;
  label: string;
  entries: { entryId: string; teamId: string; name: string; aliases: string[] }[];
};
export type VenueOption = { id: string; name: string };

/** Venue picker with a "new venue" option (created on save). */
export function VenuePicker({
  venues,
  venueId,
  newVenue,
  onVenueId,
  onNewVenue,
}: {
  venues: VenueOption[];
  venueId: string;
  newVenue: string;
  onVenueId: (v: string) => void;
  onNewVenue: (v: string) => void;
}) {
  return (
    <>
      <Field label="Venue">
        <select name="venueId" value={venueId} onChange={(e) => onVenueId(e.target.value)} className={inputClass}>
          <option value="">To be confirmed</option>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
          <option value="__new">+ New venue…</option>
        </select>
      </Field>
      {venueId === "__new" ? (
        <Field label="New venue name">
          <input name="newVenue" value={newVenue} onChange={(e) => onNewVenue(e.target.value)} maxLength={80} required className={inputClass} />
        </Field>
      ) : null}
    </>
  );
}
