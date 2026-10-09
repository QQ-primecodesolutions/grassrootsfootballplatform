"use client";

import { useId, useState } from "react";
import { uploadLogoAction } from "@/app/admin/media-actions";
import { inputClass } from "./fields";
import { prepareLogo } from "./resize-image";

/**
 * A logo picker for admin forms: upload from the phone (shrunk in the browser first), remove,
 * or paste a link. Submits the chosen value as a normal form field (`name`, default "logoUrl").
 * With `orgId`, a super admin uploads for that organisation.
 */
export function LogoField({
  label,
  hint,
  defaultValue,
  name = "logoUrl",
  orgId,
}: {
  label: string;
  hint?: string;
  defaultValue: string | null;
  name?: string;
  orgId?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const inputId = useId();

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const blob = await prepareLogo(file).catch(() => {
        throw new Error("That picture can't be read here. Use a PNG or JPEG image.");
      });
      const data = new FormData();
      data.set("file", new File([blob], blob.type === "image/png" ? "logo.png" : "logo.jpg", { type: blob.type }));
      if (orgId) data.set("orgId", orgId);
      const result = await uploadLogoAction(data);
      if (result.ok) {
        setValue(result.path);
        setMessage({ ok: true, text: "Uploaded. Save the form to use it." });
      } else {
        setMessage({ ok: false, text: result.message });
      }
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "The upload failed. Try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <span className="text-sm font-semibold">{label}</span>
      <input type="hidden" name={name} value={value} />
      <div className="mt-1 flex items-center gap-3 rounded-lg bg-white p-2 ring-1 ring-black/15">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-gray-100">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element -- previews an uploaded file or any link
            <img src={value} alt="" className="max-h-16 max-w-16 object-contain" />
          ) : (
            <span className="text-xs text-gray-500">No logo</span>
          )}
        </div>
        <div className="flex flex-1 flex-wrap gap-2">
          <label
            htmlFor={inputId}
            className={`flex h-11 cursor-pointer items-center rounded-lg bg-gray-900 px-3 text-sm font-semibold text-white ${busy ? "opacity-60" : ""}`}
          >
            {busy ? "Uploading…" : value ? "Change" : "Upload logo"}
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/*"
            disabled={busy}
            className="sr-only"
            onChange={(e) => {
              void onPick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {value ? (
            <button
              type="button"
              onClick={() => {
                setValue("");
                setMessage({ ok: true, text: "Logo removed. Save the form to apply." });
              }}
              className="h-11 rounded-lg px-3 text-sm font-semibold text-red-800 ring-1 ring-black/10"
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
      {message ? (
        <p role="status" className={`mt-1 text-sm font-semibold ${message.ok ? "text-green-800" : "text-red-700"}`}>
          {message.text}
        </p>
      ) : null}
      {hint ? <span className="mt-1 block text-xs text-gray-600">{hint}</span> : null}
      <details className="mt-1 text-sm">
        <summary className="cursor-pointer text-gray-700">Or paste a link</summary>
        <input
          aria-label={`${label} link`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://…"
          maxLength={500}
          className={inputClass}
        />
      </details>
    </div>
  );
}
