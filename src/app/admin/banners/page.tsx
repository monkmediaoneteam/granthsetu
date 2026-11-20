import { redirect } from "next/navigation";
import { ArrowDown, ArrowUp, ImagePlus, Plus, Settings2 } from "lucide-react";
import { isAdmin } from "@/lib/admin-auth";
import { getAdminContent } from "@/lib/content";
import AdminShell from "@/components/AdminShell";
import { LAYOUTS, POSITIONS, mergeSections, ratio, sectionKeyOf, sizeLabel, toIndiaInput } from "@/lib/banner-sections";
import BannerForm, { type AdminBanner } from "./BannerForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Banners", robots: { index: false, follow: false } };

const at = (v: string | null) => (v ? Date.parse(v.replace(" ", "T")) : NaN);
// What the site does with a banner right now.
function state(b: AdminBanner, now = Date.now()): { label: string; live: boolean } {
  if (b.status !== "published") return { label: b.status === "draft" ? "Draft" : "Archived", live: false };
  if (!b.image_url) return { label: "No image", live: false };
  if (b.publish_at && at(b.publish_at) > now) return { label: "Scheduled", live: false };
  if (b.ends_at && at(b.ends_at) <= now) return { label: "Ended", live: false };
  return { label: "Live", live: true };
}

export default async function BannersPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string; new?: string }> }) {
  const { saved, error, new: newKey } = await searchParams;
  if (!(await isAdmin())) redirect("/admin/login");
  const modules = await getAdminContent("modules") as unknown as (AdminBanner & { type: string })[];
  const sections = mergeSections(modules);
  const banners = modules.filter((m) => m.type === "banner");
  const known = new Set(sections.map((s) => s.key));
  const orphans = banners.filter((b) => !known.has(sectionKeyOf(b.payload?.placement)));
  const adding = newKey && known.has(newKey) ? newKey : null;

  return <AdminShell active="banners" title="Banners" subtitle="Every banner on the site is an image you choose here. Where they show, their layout, count and size are set under Sections."
    actions={<a className="btn btn-ghost" href="/admin/banners/sections"><Settings2 size={16} aria-hidden="true" />Sections and layout</a>}>
    {saved && <p className="mb-4 rounded-2 border border-brand/30 bg-brand/5 px-4 py-3 text-[15px] text-brand" role="status">Saved. The site is updated.</p>}
    {error && <p className="mb-4 rounded-2 border border-danger/30 bg-danger/10 px-4 py-3 text-[15px] text-danger" role="alert"><strong>Not saved.</strong> {error}</p>}

    <details id="new-banner" className="mb-8 rounded-xl border border-line bg-white p-4" open={!!adding || !banners.length}>
      <summary className="flex cursor-pointer items-center gap-2 font-medium"><Plus size={16} aria-hidden="true" /> New banner</summary>
      <div className="pt-4"><BannerForm sections={sections} sectionKey={adding ?? undefined} /></div>
    </details>

    <div className="grid gap-8">{sections.map((section) => {
      const list = banners.filter((b) => sectionKeyOf(b.payload?.placement) === section.key);
      const liveIds = list.filter((b) => state(b).live).slice(0, section.max).map((b) => b.id);
      return <section key={section.key} aria-labelledby={`sec-${section.key}`}>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id={`sec-${section.key}`} className="text-lg font-semibold">{section.name}{!section.enabled && <span className="ml-2 rounded-full bg-bg-3 px-2.5 py-0.5 text-xs font-medium text-ink-soft">Off</span>}</h2>
            <p className="text-sm text-ink-soft">{POSITIONS[section.position].label} · {LAYOUTS[section.layout]} · shows up to {section.max} · image {sizeLabel(section.width, section.height)}</p>
          </div>
          <a className="btn btn-ghost min-h-10 px-4 py-2 text-sm" href={`/admin/banners?new=${section.key}#new-banner`}><ImagePlus size={16} aria-hidden="true" />Add image</a>
        </div>
        {!list.length && <p className="rounded-xl border border-dashed border-line-2 p-4 text-sm text-ink-soft">
          {section.empty === "placeholder" ? "Empty. The site shows a plain placeholder image here until you add a banner." : "Empty. The site leaves this space out until you add a banner."}</p>}
        <ol className="grid gap-3">{list.map((b, i) => {
          const s = state(b);
          const waiting = s.live && !liveIds.includes(b.id);
          return <li key={b.id} className="rounded-xl border border-line bg-white p-4">
            <div className="grid items-start gap-4 md:grid-cols-[240px_minmax(0,1fr)_auto]">
              <div className="overflow-hidden rounded-lg border border-line bg-bg-2" style={{ aspectRatio: ratio(section.width, section.height) }}>
                {b.image_url ? <img src={b.image_url} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center text-xs text-ink-soft">No image</span>}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{b.title}</h3>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.live && !waiting ? "bg-brand/10 text-brand" : "bg-bg-3 text-ink-soft"}`}>{waiting ? `Live, not showing (section shows ${section.max})` : s.label}</span>
                  {b.mobile_image_url && <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-soft">Phone image</span>}</div>
                <p className="mt-1 text-sm text-ink-soft">{b.link_url ? `Links to ${b.link_url}` : "Not linked"}
                  {b.publish_at ? ` · from ${toIndiaInput(b.publish_at).replace("T", " ")}` : ""}{b.ends_at ? ` · until ${toIndiaInput(b.ends_at).replace("T", " ")}` : ""}</p>
              </div>
              {list.length > 1 && <div className="flex gap-2">
                {(["up", "down"] as const).map((direction) => <form key={direction} action="/api/admin/platform/content" method="post">
                  <input type="hidden" name="section" value="modules" /><input type="hidden" name="id" value={b.id} /><input type="hidden" name="action" value="move" />
                  <input type="hidden" name="direction" value={direction} /><input type="hidden" name="return_to" value="/admin/banners" />
                  <button type="submit" className="round-btn" aria-label={`Move ${b.title} ${direction}`} disabled={direction === "up" ? i === 0 : i === list.length - 1}>
                    {direction === "up" ? <ArrowUp size={16} aria-hidden="true" /> : <ArrowDown size={16} aria-hidden="true" />}</button></form>)}
              </div>}
            </div>
            <details className="mt-3 border-t border-line pt-3"><summary className="cursor-pointer text-sm font-medium">Edit</summary><div className="pt-4"><BannerForm banner={b} sections={sections} /></div></details>
          </li>;
        })}</ol>
      </section>;
    })}</div>

    {orphans.length > 0 && <section className="mt-8" aria-labelledby="orphans">
      <h2 id="orphans" className="text-lg font-semibold">Not in any section</h2>
      <p className="mb-3 text-sm text-ink-soft">These banners point to a section that was deleted, so they do not show. Edit one to move it into a section.</p>
      <ol className="grid gap-3">{orphans.map((b) => <li key={b.id} className="rounded-xl border border-line bg-white p-4"><h3 className="font-semibold">{b.title}</h3>
        <details className="mt-3 border-t border-line pt-3"><summary className="cursor-pointer text-sm font-medium">Edit</summary><div className="pt-4"><BannerForm banner={b} sections={sections} /></div></details></li>)}</ol>
    </section>}
  </AdminShell>;
}
