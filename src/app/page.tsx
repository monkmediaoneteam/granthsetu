import { getPublicContent } from "@/lib/content";
import { bestsellerSlugs, getCategories, getPublishedAuthors, getStoreBooks } from "@/lib/store-data";
import { buildHome } from "@/lib/home";
import { siteUrl } from "@/lib/store";
import BookCard from "@/components/BookCard";
import Carousel from "@/components/Carousel";
import BannerCarousel from "@/components/home/BannerCarousel";
import PromoGrid from "@/components/home/PromoGrid";
import GenreSwitcher from "@/components/home/GenreSwitcher";
import LanguageShelf from "@/components/home/LanguageShelf";
import CategoryTiles from "@/components/home/CategoryTiles";
import AuthorStrip from "@/components/home/AuthorStrip";
import PublishBanner from "@/components/home/PublishBanner";

export const dynamic = "force-dynamic";
export const metadata = { alternates: { canonical: siteUrl() } };

export default async function Home() {
  const now = new Date();
  const [books, categories, content, bestsellers, authors] = await Promise.all([getStoreBooks(now), getCategories(), getPublicContent(), bestsellerSlugs(), getPublishedAuthors()]);
  const home = buildHome({ books, categories, modules: content.modules, bestsellers, authors, now });
  const enabled = process.env.COMMERCE_ENABLED === "true";
  const rail = (key: string) => home.rails.find((r) => r.key === key);
  const railView = (key: string) => {
    const r = rail(key);
    return r && <div className="wrap section" key={key}><Carousel title={r.title} tagline={r.tagline} href={r.href}>{r.books.map((b) => <BookCard key={b.slug} book={b} enabled={enabled} />)}</Carousel></div>;
  };
  return <>
    <h1 className="sr-only">Digital books across every category</h1>
    <BannerCarousel banners={home.banners} />
    {railView("bestsellers")}
    <PromoGrid promos={home.promos} enabled={enabled} />
    {railView("new")}
    {railView("offers")}
    <GenreSwitcher genres={home.genres} enabled={enabled} />
    {railView("soon")}
    <CategoryTiles tiles={home.categoryTiles} />
    <LanguageShelf languages={home.languages} />
    <AuthorStrip authors={home.authors} />
    <PublishBanner />
    {!books.length && <p className="wrap section">New titles are on their way. Check back soon.</p>}
  </>;
}
