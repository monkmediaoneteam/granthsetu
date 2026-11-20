import { redirect } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { isAdmin } from "@/lib/admin-auth";
import { getAdminContent } from "@/lib/content";
import AdminShell from "@/components/AdminShell";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { LAYOUTS, LIMITS, POSITIONS, mergeSections, sectionKeyOf, sizeLabel, type BannerSection } from "@/lib/banner-sections";

export const dynamic = "force-dynamic";
export const metadata = { title: "Banner sections", robots: { index: false, follow: false } };

const input = "field-input mt-1";
const num = (name: string, label: string, value: number, [min, max]: readonly [number, number], hint?: string) =>
  <label className="text-sm">{label}<input name={name} type="number" required min={min} max={max} step={1} className={input} defaultValue={value} />
    {hint && <span className="mt-1 block text-xs text-ink-soft">{hint}</span>}</label>;

// One section's settings. Saving a built-in section stores the admin's version; "Reset" brings back the default.
function SectionForm({ section, isNew }: { section: BannerSection; isNew?: boolean }) {
  return <form action="/api/admin/platform/content" method="post" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <input type="hidden" name="section" value="modules" /><input type="hidden" name="type" value="banner-section" />
    <input type="hidden" name="id" value={section.id ?? ""} /><input type="hidden" name="updated_at" value={section.updatedAt ?? ""} />
    <input type="hidden" name="status" value="published" /><input type="hidden" name="return_to" value="/admin/banners/sections" />
    {!isNew && <input type="hidden" name="key" value={section.key} />}

    <label className="text-sm sm:col-span-2">Name<input name="title" required maxLength={200} className={input} defaultValue={isNew ? "" : section.name} placeholder="Festival offers row" /></label>
    {isNew ? <label className="text-sm">Key<input name="key" required maxLength={40} pattern="[a-z0-9]+(-[a-z0-9]+)*" className={input} placeholder="festival-row" />
      <span className="mt-1 block text-xs text-ink-soft">Short ID, lowercase. Cannot be changed later.</span></label>
      : <p className="text-sm">Key<span className="field-input mt-1 block bg-bg-2 text-ink-soft">{section.key}</span></p>}
    <label className="text-sm">Switched<select name="enabled" className={input} defaultValue={section.enabled ? "on" : "off"}><option value="on">On</option><option value="off">Off (hidden on the site)</option></select></label>

    <label className="text-sm sm:col-span-2">Where it shows<select name="position" className={input} defaultValue={section.position}>
      {Object.entries(POSITIONS).map(([value, p]) => <option key={value} value={value}>{p.label}</option>)}</select></label>
    <label className="text-sm sm:col-span-2">Layout<select name="layout" className={input} defaultValue={section.layout}>
      {Object.entries(LAYOUTS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>

    {num("max", "Banners shown (max)", section.max, LIMITS.max, "Live banners beyond this wait their turn.")}
    {num("columns", "Columns (grid)", section.columns, LIMITS.columns, "Used by the grid layout.")}
    {num("autoplay", "Autoplay, seconds", section.autoplay, LIMITS.autoplay, "Carousel only. 0 = no autoplay.")}
    <label className="text-sm">When empty<select name="empty" className={input} defaultValue={section.empty}>
      <option value="placeholder">Show a plain placeholder image</option><option value="hide">Leave the space out</option></select></label>

    {num("width", "Image width, px", section.width, LIMITS.width)}
    {num("height", "Image height, px", section.height, LIMITS.height, "Width and height set the banner's shape on screens wider than a phone.")}
    {num("mobile_width", "Phone image width, px", section.mobileWidth, LIMITS.width)}
    {num("mobile_height", "Phone image height, px", section.mobileHeight, LIMITS.height, "Shape on phones, for banners that have a phone image.")}
    {num("sort", "Order", section.sort, [-1000, 1000], "Lower first, among sections in the same place.")}

    <div className="flex flex-wrap items-end gap-3 sm:col-span-2 lg:col-span-3">
      <button name="action" value="save" type="submit" className="btn btn-primary">{isNew ? "Add section" : "Save section"}</button>
      {!isNew && section.id && <ConfirmSubmit name="action" value="delete" formNoValidate className="btn btn-ghost"
        message={section.builtIn ? `Reset "${section.name}" to its default settings?` : `Delete the section "${section.name}"? Its banners stay saved but stop showing until moved to another section.`}>
        {section.builtIn ? "Reset to default" : "Delete section"}</ConfirmSubmit>}
    </div>
  </form>;
}

export default async function SectionsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const { saved, error } = await searchParams;
  if (!(await isAdmin())) redirect("/admin/login");
  const modules = await getAdminContent("modules") as unknown as { id: string; type: string; title: string; sort: number; payload: Record<string, unknown>; updated_at: string }[];
  const sections = mergeSections(modules);
  const count = (key: string) => modules.filter((m) => m.type === "banner" && sectionKeyOf(m.payload?.placement) === key).length;
  const blank: BannerSection = { key: "", name: "", position: "home-after-categories", layout: "grid", max: 3, columns: 3, width: 800, height: 450,
    mobileWidth: 800, mobileHeight: 600, autoplay: 0, empty: "hide", enabled: true, sort: 50, builtIn: false };

  return <AdminShell active="banners" title="Banner sections" subtitle="Where image banners appear, their layout, how many show and at what size. Add banners to a section on the Banners screen."
    actions={<a className="btn btn-ghost" href="/admin/banners"><ArrowLeft size={16} aria-hidden="true" />Banners</a>}>
    {saved && <p className="mb-4 rounded-2 border border-brand/30 bg-brand/5 px-4 py-3 text-[15px] text-brand" role="status">Saved. The site is updated.</p>}
    {error && <p className="mb-4 rounded-2 border border-danger/30 bg-danger/10 px-4 py-3 text-[15px] text-danger" role="alert"><strong>Not saved.</strong> {error}</p>}

    <details className="mb-8 rounded-xl border border-line bg-white p-4">
      <summary className="flex cursor-pointer items-center gap-2 font-medium"><Plus size={16} aria-hidden="true" /> New section</summary>
      <div className="pt-4"><SectionForm section={blank} isNew /></div>
    </details>

    <div className="grid gap-4">{sections.map((s) => <section key={s.key} className="rounded-xl border border-line bg-white p-4" aria-labelledby={`s-${s.key}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={`s-${s.key}`} className="text-lg font-semibold">{s.name}</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.enabled ? "bg-brand/10 text-brand" : "bg-bg-3 text-ink-soft"}`}>{s.enabled ? "On" : "Off"}</span>
        <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-soft">{s.builtIn ? (s.id ? "Built-in, customised" : "Built-in") : "Custom"}</span>
      </div>
      <p className="mt-1 text-sm text-ink-soft">{POSITIONS[s.position].label} · {LAYOUTS[s.layout]} · up to {s.max}{s.layout === "grid" ? ` in ${s.columns} columns` : ""} · {sizeLabel(s.width, s.height)} · {count(s.key)} banner{count(s.key) === 1 ? "" : "s"}</p>
      <details className="mt-3 border-t border-line pt-3"><summary className="cursor-pointer text-sm font-medium">Edit settings</summary><div className="pt-4"><SectionForm section={s} /></div></details>
    </section>)}</div>
  </AdminShell>;
}
