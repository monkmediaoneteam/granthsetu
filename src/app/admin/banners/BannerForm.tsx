"use client";

import { useState } from "react";
import ImageField from "@/components/ImageField";
import { LAYOUTS, POSITIONS, ratio, sectionKeyOf, sizeLabel, toIndiaInput, type BannerSection } from "@/lib/banner-sections";

export type AdminBanner = { id: string; title: string; image_url: string | null; mobile_image_url: string | null; link_url: string | null;
  payload: Record<string, unknown>; sort: number; status: string; publish_at: string | null; ends_at: string | null; updated_at: string };

// Payload settings this form does not edit; sent back unchanged so saving keeps them.
const KEPT_PAYLOAD = ["attribution", "collection_slug", "author_id", "video_url", "theme", "size", "category_slug"];

const input = "field-input mt-1";

// One banner: the section it goes in, its image (and optional phone image), where a click goes, and when it shows.
// The image is the whole banner; nothing is written over it on the site.
// A save returns to `returnTo` (or `doneTo` when given); a refused save returns to `returnTo` with the reason.
export default function BannerForm({ banner, sections, sectionKey, returnTo, doneTo }: { banner?: AdminBanner; sections: BannerSection[]; sectionKey?: string; returnTo: string; doneTo?: string }) {
  const initial = banner ? sectionKeyOf(banner.payload?.placement) : sectionKey ?? sections[0]?.key ?? "hero";
  const [key, setKey] = useState(initial);
  const s = sections.find((x) => x.key === key) ?? sections[0];
  const preset = s && s.width / s.height >= 2 ? "hero" : "side";
  return <form action="/api/admin/platform/content" method="post" className="grid gap-5 sm:grid-cols-2">
    <input type="hidden" name="section" value="modules" /><input type="hidden" name="type" value="banner" />
    <input type="hidden" name="id" value={banner?.id ?? ""} /><input type="hidden" name="updated_at" value={banner?.updated_at ?? ""} />
    <input type="hidden" name="sort" value={String(banner?.sort ?? 1000)} />
    <input type="hidden" name="return_to" value={returnTo} />{doneTo && <input type="hidden" name="done_to" value={doneTo} />}
    {KEPT_PAYLOAD.filter((k) => typeof banner?.payload?.[k] === "string" && banner.payload[k]).map((k) => <input key={k} type="hidden" name={k} value={String(banner!.payload[k])} />)}

    <label className="text-sm">Name<input name="title" required maxLength={200} className={input} defaultValue={banner?.title ?? ""} placeholder="Diwali sale, 20% off" />
      <span className="mt-1 block text-xs text-ink-soft">Describes the image for screen readers and search. Not shown on the page.</span></label>
    <label className="text-sm">Section<select name="placement" className={input} value={key} onChange={(e) => setKey(e.target.value)}>
      {sections.map((x) => <option key={x.key} value={x.key}>{x.name}{x.enabled ? "" : " (off)"}</option>)}</select>
      {s && <span className="mt-1 block text-xs text-ink-soft">{POSITIONS[s.position].label}. {LAYOUTS[s.layout]}, up to {s.max}. Image {sizeLabel(s.width, s.height)}.</span>}</label>

    {s && <div className="sm:col-span-2 grid gap-5 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <ImageField key={`img-${key}`} name="image_url" label="Banner image (required)" value={banner?.image_url ?? ""} ratio={ratio(s.width, s.height)}
        presetCategory={preset} expect={{ width: s.width, height: s.height }}
        hint={`This section uses ${sizeLabel(s.width, s.height)}. JPEG, PNG or WebP, up to 5 MB. Put any text into the image itself.`} />
      <ImageField key={`mob-${key}`} name="mobile_image_url" label="Phone image (optional)" value={banner?.mobile_image_url ?? ""} ratio={ratio(s.mobileWidth, s.mobileHeight)}
        presetCategory={preset} expect={{ width: s.mobileWidth, height: s.mobileHeight }}
        hint={`Shown on phones instead, ${sizeLabel(s.mobileWidth, s.mobileHeight)}. Leave empty to use the main image.`} />
    </div>}

    <label className="text-sm sm:col-span-2">Link when clicked (optional)<input name="link_url" maxLength={2000} className={input} defaultValue={banner?.link_url ?? ""} placeholder="/search?offer=1 or https://..." /></label>
    <label className="text-sm">Starts (India time, optional)<input name="publish_at" type="datetime-local" className={input} defaultValue={toIndiaInput(banner?.publish_at ?? null)} /></label>
    <label className="text-sm">Ends (India time, optional)<input name="ends_at" type="datetime-local" className={input} defaultValue={toIndiaInput(banner?.ends_at ?? null)} /></label>
    <label className="text-sm">Status<select name="status" className={input} defaultValue={banner?.status ?? "published"}>
      <option value="published">Published: shows on the site</option><option value="draft">Draft: hidden, not finished</option><option value="archived">Archived: hidden, kept for later</option></select></label>
    <div className="flex items-end gap-3 sm:col-span-2">
      <button name="action" value="save" type="submit" className="btn btn-primary">{banner ? "Save changes" : "Add banner"}</button>
      <a className="btn btn-ghost" href="/admin/banners">Cancel</a>
    </div>
  </form>;
}
