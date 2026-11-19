"use client";

import { useRef, useState } from "react";
import { put } from "@vercel/blob/client";
import { Check, Eye, ImageUp, RefreshCw, Trash2, X } from "lucide-react";

const MAX = 5 * 1024 * 1024;
// Uploads accept the three raster formats the server checks by their bytes. Built-in presets may be SVG.
const TYPES = ["image/jpeg", "image/png", "image/webp"];

export type ImagePreset = { label: string; url: string };

// Built-in artwork an admin can pick instead of uploading. Generated placeholders are used until an image is set.
const PRESETS: Record<string, ImagePreset[]> = {
  hero: [
    { label: "Botanical (desktop)", url: "/assets/banners/hero-botanical-desktop.svg" },
    { label: "Botanical (mobile)", url: "/assets/banners/hero-botanical-mobile.svg" },
  ],
  side: [
    { label: "Special offer (desktop)", url: "/assets/banners/side-deal-desktop.svg" },
    { label: "Special offer (mobile)", url: "/assets/banners/side-deal-mobile.svg" },
    { label: "Digital library (desktop)", url: "/assets/banners/side-library-desktop.svg" },
    { label: "Digital library (mobile)", url: "/assets/banners/side-library-mobile.svg" },
  ],
  category: [
    { label: "Ayurveda", url: "/assets/categories/ayurveda.svg" },
    { label: "Phytopharmaceuticals", url: "/assets/categories/phytopharmaceuticals.svg" },
    { label: "Research methodology", url: "/assets/categories/research.svg" },
    { label: "Natural products", url: "/assets/categories/natural-products.svg" },
    { label: "Health & wellness", url: "/assets/categories/health-wellness.svg" },
    { label: "Science & botanical chemistry", url: "/assets/categories/science.svg" },
  ],
};

// An image slot in an admin form: shows the current image (or the placeholder that will be used), upload to private
// storage (checked by the server), presets, paste an address, and remove. The address goes into a normal form field.
export default function ImageField({
  name, label, value = "", hint, ratio = "16 / 7", presetCategory,
}: { name: string; label: string; value?: string; hint?: string; ratio?: string; presetCategory?: "hero" | "side" | "category" }) {
  const picker = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(value);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function post(body: object) {
    const response = await fetch("/api/admin/media", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Upload failed. Try again.");
    return result;
  }

  async function upload(file: File) {
    setError(""); setStatus("");
    if (file.size > MAX) { setError(`That image is ${(file.size / 1048576).toFixed(1)} MB. The limit is 5 MB.`); return; }
    if (!TYPES.includes(file.type)) { setError("Choose a JPEG, PNG or WebP image."); return; }
    setBusy(true);
    try {
      const ticket = await post({ action: "ticket" });
      await put(ticket.pathname, file, { access: "private", token: ticket.token, contentType: file.type,
        onUploadProgress: ({ percentage }) => setStatus(`Uploading ${Math.round(percentage)}%`) });
      setStatus("Checking the image...");
      const { url: saved } = await post({ action: "finalize", pathname: ticket.pathname });
      setUrl(saved);
      setStatus("Image ready. Save to put it live.");
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed."); setStatus(""); }
    finally { setBusy(false); }
  }

  const presets = presetCategory ? PRESETS[presetCategory] : [];

  return <div className="grid gap-2 text-sm">
    <div className="flex items-center justify-between">
      <span className="font-medium text-ink">{label}</span>
      {url && <span className="text-xs font-medium text-brand">Custom image set</span>}
    </div>
    <input type="hidden" name={name} value={url} />

    <div className="relative overflow-hidden rounded-xl border border-line bg-bg-2" style={{ aspectRatio: ratio }}>
      {url ? <img src={url} alt="" className="h-full w-full object-cover" />
        : <span className="grid h-full w-full place-items-center p-4 text-center text-ink-soft">
          <span className="grid justify-items-center gap-1.5">
            <ImageUp size={22} aria-hidden="true" />
            <span className="font-medium">No custom image set</span>
            <span className="text-xs">The store shows its built-in placeholder until you upload one.</span>
          </span></span>}
      {url && <button type="button" onClick={() => { setUrl(""); setStatus("Image removed. Save to apply."); }} disabled={busy}
        className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/95 text-danger shadow-md hover:bg-white" aria-label={`Remove ${label.toLowerCase()}`}>
        <X size={16} aria-hidden="true" /></button>}
    </div>

    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="btn btn-ghost min-h-10 px-4 py-2 text-sm" disabled={busy} onClick={() => picker.current?.click()}>
        {url ? <RefreshCw size={15} aria-hidden="true" /> : <ImageUp size={15} aria-hidden="true" />}{busy ? "Uploading..." : url ? "Replace image" : "Upload image"}</button>
      <details className="text-xs text-ink-soft"><summary className="cursor-pointer hover:text-ink">or paste an address</summary>
        <div className="mt-1 flex items-center gap-2">
          <input value={url} onChange={(e) => setUrl(e.target.value.trim())} maxLength={2000} placeholder="/assets/... or https://..."
            className="field-input h-9 w-64 max-w-full text-xs" aria-label={`${label} address`} />
          {url && <a href={url} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-white text-ink-soft hover:text-ink" title="Preview in new tab"><Eye size={14} aria-hidden="true" /></a>}
        </div></details>
    </div>

    {presets.length > 0 && <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
      <span className="text-ink-mute">Presets:</span>
      {presets.map((preset) => <button key={preset.url} type="button" onClick={() => { setUrl(preset.url); setStatus(`Selected ${preset.label}. Save to apply.`); }}
        className={`rounded-md border px-2 py-1 transition-colors ${url === preset.url ? "border-brand bg-brand/10 font-medium text-brand" : "border-line bg-white text-ink-soft hover:border-ink-soft"}`}>
        {url === preset.url && <Check size={12} className="mr-1 inline" aria-hidden="true" />}{preset.label}</button>)}
    </div>}

    <input ref={picker} type="file" className="sr-only" tabIndex={-1} aria-hidden="true" accept={TYPES.join(",")} disabled={busy}
      onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) upload(file); }} />
    <span className="text-xs text-ink-soft">{hint ?? "JPEG, PNG or WebP, up to 5 MB."}</span>
    {status && <p className="text-[13px] text-brand" role="status">{status}</p>}
    {error && <p className="text-[13px] text-danger" role="alert">{error}</p>}
  </div>;
}
