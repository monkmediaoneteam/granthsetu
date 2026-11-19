"use client";

import { useState } from "react";
import ImageField from "@/components/ImageField";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { BANNER_SLOTS, SLOT_KEYS, toIndiaInput, toSlot, type BannerSlot } from "@/lib/banner-slots";

export type AdminBanner = { id: string; title: string; image_url: string | null; mobile_image_url: string | null; link_url: string | null;
  payload: Record<string, unknown>; sort: number; status: string; publish_at: string | null; ends_at: string | null; updated_at: string };

// Payload settings this form does not edit (set under Homepage sections); sent back unchanged so saving keeps them.
const KEPT_PAYLOAD = ["attribution", "collection_slug", "author_id", "video_url", "theme", "size", "category_slug"];


const input = "field-input mt-1";

// One banner: which slot it fills, its image (and optional phone image), where a click goes, and when it shows.
// The image is the whole banner; nothing is written over it on the homepage.
export default function BannerForm({ banner, slot: initialSlot }: { banner?: AdminBanner; slot?: BannerSlot }) {
  const [slot, setSlot] = useState<BannerSlot>(banner ? toSlot(banner.payload?.placement) : initialSlot ?? "hero");
  const info = BANNER_SLOTS[slot];
  return <form action="/api/admin/platform/content" method="post" className="grid gap-4 sm:grid-cols-2">
    <input type="hidden" name="section" value="modules" /><input type="hidden" name="type" value="banner" />
    <input type="hidden" name="id" value={banner?.id ?? ""} /><input type="hidden" name="updated_at" value={banner?.updated_at ?? ""} />
    <input type="hidden" name="sort" value={String(banner?.sort ?? 1000)} /><input type="hidden" name="return_to" value="/admin/banners" />
    {KEPT_PAYLOAD.filter((k) => typeof banner?.payload?.[k] === "string" && banner.payload[k]).map((k) => <input key={k} type="hidden" name={k} value={String(banner!.payload[k])} />)}

    <label className="text-sm">Where it shows<select name="placement" className={input} value={slot} onChange={(e) => setSlot(toSlot(e.target.value))}>
      {SLOT_KEYS.map((key) => <option key={key} value={key}>{BANNER_SLOTS[key].label}</option>)}</select>
      <span className="mt-1 block text-xs text-ink-soft">{info.where}</span></label>
    <label className="text-sm">Name<input name="title" required maxLength={200} className={input} defaultValue={banner?.title ?? ""} placeholder="Diwali sale, 20% off" />
      <span className="mt-1 block text-xs text-ink-soft">Describes the image for screen readers and search. Not shown on the page.</span></label>

    <div className="sm:col-span-2 grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <ImageField key={`img-${slot}`} name="image_url" label="Banner image (required)" value={banner?.image_url ?? ""} ratio={info.ratio}
        presetCategory={info.preset} hint={`Recommended ${info.size}. JPEG, PNG or WebP, up to 5 MB. Put any text into the image itself.`} />
      <ImageField key={`mob-${slot}`} name="mobile_image_url" label="Phone image (optional)" value={banner?.mobile_image_url ?? ""} ratio={info.mobileRatio}
        presetCategory={info.preset} hint={`Shown on phones instead, about ${info.mobileSize}. Leave empty to use the main image.`} />
    </div>

    <label className="text-sm sm:col-span-2">Link when clicked (optional)<input name="link_url" maxLength={2000} className={input} defaultValue={banner?.link_url ?? ""} placeholder="/search?offer=1 or https://..." /></label>
    <label className="text-sm">Starts (India time, optional)<input name="publish_at" type="datetime-local" className={input} defaultValue={toIndiaInput(banner?.publish_at ?? null)} /></label>
    <label className="text-sm">Ends (India time, optional)<input name="ends_at" type="datetime-local" className={input} defaultValue={toIndiaInput(banner?.ends_at ?? null)} /></label>
    <label className="text-sm">Status<select name="status" className={input} defaultValue={banner?.status ?? "published"}>
      <option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select></label>
    <div className="flex items-end gap-3">
      <button name="action" value="save" type="submit" className="btn btn-primary">{banner ? "Save banner" : "Add banner"}</button>
      {banner && <ConfirmSubmit name="action" value="delete" formNoValidate className="btn btn-ghost" message={`Delete the banner "${banner.title}"? This cannot be undone.`}>Delete</ConfirmSubmit>}
    </div>
  </form>;
}
