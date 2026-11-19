import { getCategories, getStoreBooks, bestsellerSlugs } from "@/lib/store-data";
import { flag } from "@/lib/env";
import { parseListing } from "@/lib/listing";
import Listing from "@/components/Listing";
import BandBanner from "@/components/home/BandBanner";
import { getPublicContent } from "@/lib/content";
import { slotBanner } from "@/lib/home";

export const dynamic = "force-dynamic";
type Query = Record<string, string | string[] | undefined>;
export async function generateMetadata({ searchParams }: { searchParams: Promise<Query> }) {
  const p = parseListing(await searchParams);
  return { title: p.q ? `Search: ${p.q}` : "All books", robots: p.q ? { index: false } : undefined };
}

export default async function Search({ searchParams }: { searchParams: Promise<Query> }) {
  const [query, books, categories, popularity, content] = await Promise.all([searchParams, getStoreBooks(), getCategories(), bestsellerSlugs(90, 200), getPublicContent()]);
  const params = parseListing(query);
  return <Listing base="/search" title={params.q ? `Results for "${params.q}"` : params.offer ? "Offers" : "All books"} books={books} params={params}
    categories={categories} popularity={popularity} enabled={flag("COMMERCE_ENABLED")}
    promo={<BandBanner banner={slotBanner(content.modules, "listing")} wrapClass="wrap listing-promo" />} />;
}
