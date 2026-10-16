import { getPublicContent } from "@/lib/content";
import { bestsellerSlugs, getCategories, getPublishedAuthors, getStoreBooks } from "@/lib/store-data";
import { buildHome } from "@/lib/home";
import { siteUrl } from "@/lib/store";
import HeroCampaign from "@/components/home/HeroCampaign";
import CategoryTiles from "@/components/home/CategoryTiles";
import Featured from "@/components/home/Featured";
import LookInside from "@/components/home/LookInside";
import LanguageStrip from "@/components/home/LanguageStrip";
import AuthorChips from "@/components/home/AuthorChips";
import PublishBand from "@/components/home/PublishBand";
import FaqGrid from "@/components/home/FaqGrid";

export const dynamic = "force-dynamic";
export const metadata = { alternates: { canonical: siteUrl() } };

export default async function Home() {
  const now = new Date();
  const [books, categories, content, bestsellers, authors] = await Promise.all([getStoreBooks(now), getCategories(), getPublicContent(), bestsellerSlugs(), getPublishedAuthors()]);
  const home = buildHome({ books, categories, modules: content.modules, bestsellers, authors, now });
  const enabled = process.env.COMMERCE_ENABLED === "true";
  const covers = [...(home.rails.find((r) => r.key === "bestsellers")?.books ?? []), ...books]
    .filter((b, i, all) => b.cover && all.findIndex((x) => x.slug === b.slug) === i).slice(0, 3)
    .map(({ slug, title, cover }) => ({ slug, title, cover }));
  return <>
    <HeroCampaign banners={home.banners} covers={covers} />
    <CategoryTiles tiles={home.categoryTiles.map(({ slug, name, count, covers: c }) => ({ slug, name, count, covers: c }))} />
    <Featured books={books} rails={home.rails} enabled={enabled} />
    <LookInside books={books} />
    <LanguageStrip languages={home.languages} />
    <AuthorChips authors={home.authors} />
    <PublishBand covers={covers} />
    <FaqGrid />
  </>;
}
