import { getPublicContent } from "@/lib/content";
import { flag } from "@/lib/env";
import { bestsellerSlugs, getCategories, getPublishedAuthors, getStoreBooks } from "@/lib/store-data";
import { buildHome, sectionsAt } from "@/lib/home";
import { siteUrl } from "@/lib/store";
import CategoryTiles from "@/components/home/CategoryTiles";
import Featured from "@/components/home/Featured";
import LookInside from "@/components/home/LookInside";
import LanguageStrip from "@/components/home/LanguageStrip";
import AuthorChips from "@/components/home/AuthorChips";
import { SectionList } from "@/components/home/BannerSectionView";
import FaqGrid from "@/components/home/FaqGrid";
import ShopStrip from "@/components/home/ShopStrip";

export const dynamic = "force-dynamic";
export const metadata = { alternates: { canonical: siteUrl() } };

export default async function Home() {
  const now = new Date();
  const [books, categories, content, bestsellers, authors] = await Promise.all([getStoreBooks(now), getCategories(), getPublicContent(), bestsellerSlugs(), getPublishedAuthors()]);
  const home = buildHome({ books, categories, modules: content.modules, bestsellers, authors, now });
  const enabled = flag("COMMERCE_ENABLED");
  // Banner sections are placed by the admin (Admin > Banners > Sections); each position renders its sections in order.
  const at = (position: Parameters<typeof sectionsAt>[1]) => sectionsAt(home.sections, position);
  const main = at("home-top-main"), side = at("home-top-side");
  return <>
    {(main.length > 0 || side.length > 0) && <div className={`wrap home-top${side.length ? "" : " home-top-full"}`}>
      <div className="home-main"><SectionList list={main} eager /></div>
      {side.length > 0 && <div className="home-side"><SectionList list={side} /></div>}
    </div>}
    <ShopStrip />
    <CategoryTiles tiles={home.categoryTiles.map(({ slug, name, count, image, covers: c }) => ({ slug, name, count, image, covers: c }))} />
    <SectionList list={at("home-after-categories")} wrap="wrap section" />
    <Featured books={books} rails={home.rails} enabled={enabled} />
    <SectionList list={at("home-after-books")} wrap="wrap section" />
    <LookInside books={books} />
    <LanguageStrip languages={home.languages} />
    <AuthorChips authors={home.authors} />
    <SectionList list={at("home-before-faq")} wrap="wrap section" />
    <FaqGrid />
  </>;
}
