import { getPublicContent } from "@/lib/content";
import { bestsellerSlugs, getCategories, getPublishedAuthors, getStoreBooks } from "@/lib/store-data";
import { buildHome } from "@/lib/home";
import { siteUrl } from "@/lib/store";
import BookCard from "@/components/BookCard";
import Carousel from "@/components/Carousel";
import AksharaHero from "@/components/home/AksharaHero";
import BannerCarousel from "@/components/home/BannerCarousel";
import SubjectIndex from "@/components/home/SubjectIndex";
import LanguageShelf from "@/components/home/LanguageShelf";
import AuthorStrip from "@/components/home/AuthorStrip";
import PublishBanner from "@/components/home/PublishBanner";

export const dynamic = "force-dynamic";
export const metadata = { alternates: { canonical: siteUrl() } };

export default async function Home() {
  const now = new Date();
  const [books, categories, content, bestsellers, authors] = await Promise.all([getStoreBooks(now), getCategories(), getPublicContent(), bestsellerSlugs(), getPublishedAuthors()]);
  const home = buildHome({ books, categories, modules: content.modules, bestsellers, authors, now });
  const enabled = process.env.COMMERCE_ENABLED === "true";
  const railView = (key: string) => {
    const r = home.rails.find((rail) => rail.key === key);
    return r && <div className="wrap section" key={key}><Carousel title={r.title} tagline={r.tagline} href={r.href}>{r.books.map((b) => <BookCard key={b.slug} book={b} enabled={enabled} />)}</Carousel></div>;
  };
  // Hero covers: the strongest shelves first, three at a time, only books that have a cover.
  const featured = [...(home.rails.find((r) => r.key === "bestsellers")?.books ?? []), ...books]
    .filter((b, i, all) => b.cover && all.findIndex((x) => x.slug === b.slug) === i).slice(0, 21)
    .map(({ slug, title, cover }) => ({ slug, title, cover }));
  // A small catalogue still shows what it has: one partial set rather than an empty stage.
  const heroSets = featured.length < 3 ? (featured.length ? [featured] : []) : Array.from({ length: Math.floor(featured.length / 3) }, (_, i) => featured.slice(i * 3, i * 3 + 3));
  const offerCovers = books.filter((b) => b.onSale && b.cover).map(({ slug, title, cover }) => ({ slug, title, cover }));
  return <>
    <AksharaHero languages={home.languages.map((l) => l.name)} covers={heroSets} />
    {railView("bestsellers")}
    <BannerCarousel banners={home.banners} covers={offerCovers.length >= 3 ? offerCovers : featured} />
    {railView("new")}
    {railView("offers")}
    <SubjectIndex subjects={home.categoryTiles.map(({ slug, name, count, covers }) => ({ slug, name, count, covers }))} />
    {railView("soon")}
    <LanguageShelf languages={home.languages} />
    <AuthorStrip authors={home.authors} />
    <PublishBanner />
    {!books.length && <p className="wrap section">New titles are on their way. Check back soon.</p>}
  </>;
}
