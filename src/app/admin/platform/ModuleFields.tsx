"use client";
import { useState } from "react";

export default function ModuleFields({ section, type, payload, collections, authors }: {
  section: string; type: string; payload: Record<string, unknown>;
  collections: { slug: string; title: string }[]; authors: { id: string; name: string }[];
}) {
  const [selected, setSelected] = useState(type);
  return <>
    {section === "modules" && <label className="text-sm">Module type<select name="type" className="field-input mt-1" value={selected} onChange={event => setSelected(event.target.value)}>
      {["hero", "banner", "text", "collection", "author"].map(value => <option key={value} value={value}>{value}</option>)}
    </select></label>}
    {["hero", "banner"].includes(selected) && <label className="text-sm">Subtitle<input name="subtitle" className="field-input mt-1" maxLength={4000} defaultValue={String(payload.subtitle ?? "")} /></label>}
    {selected === "collection" && <label className="text-sm">Collection<select name="collection_slug" required className="field-input mt-1" defaultValue={String(payload.collection_slug ?? "")}><option value="">Choose collection</option>{collections.map(collection => <option key={collection.slug} value={collection.slug}>{collection.title}</option>)}</select></label>}
    {selected === "author" && <label className="text-sm">Author<select name="author_id" required className="field-input mt-1" defaultValue={String(payload.author_id ?? "")}><option value="">Choose author</option>{authors.map(author => <option key={author.id} value={author.id}>{author.name}</option>)}</select></label>}
    {selected === "testimonial" && <label className="text-sm">Attribution<input name="attribution" className="field-input mt-1" required maxLength={4000} defaultValue={String(payload.attribution ?? "")} /></label>}
    {selected === "media" && <label className="text-sm">Video URL<input name="video_url" className="field-input mt-1" maxLength={2000} defaultValue={String(payload.video_url ?? "")} /></label>}
  </>;
}
