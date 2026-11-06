"use client";

import { useRef, useState } from "react";
import { api, errorMessage } from "@/lib/hooks";
import { CheckIcon, DocIcon } from "./icons";
import { ErrorText, IconSquare, Spinner } from "./ui";

export type Uploaded = { hash: `0x${string}`; name: string; size: number; type: string; url: string };

const kb = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

const toBase64 = async (file: File) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

/** One document to upload: tap to choose a file; it is stored and identified by its hash. */
export function UploadRow({ label, hint, value, onChange }: { label: string; hint: string; value: Uploaded | null; onChange: (u: Uploaded) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await api<Uploaded>("/api/uploads", { method: "POST", body: { name: file.name, type: file.type, data: await toBase64(file) } }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div>
      <button type="button" onClick={() => input.current?.click()} className="flex min-h-[44px] w-full items-center gap-3 px-4 py-2.5 text-left active:bg-fill">
        <IconSquare tone={value ? "green" : "gray"}>{value ? <CheckIcon /> : <DocIcon />}</IconSquare>
        <div className="min-w-0 flex-1">
          <div className="text-[17px]">{label}</div>
          <div className="truncate text-[13px] text-secondary">
            {value ? `${value.name} · ${kb(value.size)} · ${value.hash.slice(0, 10)}…` : hint}
          </div>
        </div>
        <span className="shrink-0 text-[15px] text-tint">{busy ? <Spinner /> : value ? "Replace" : "Upload"}</span>
      </button>
      <input ref={input} type="file" accept="application/pdf,image/png,image/jpeg" className="hidden" data-upload={label} onChange={(e) => pick(e.target.files?.[0])} />
      <ErrorText error={error} />
    </div>
  );
}
