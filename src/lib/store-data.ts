// Server-only by convention: it imports the database client. (The `server-only` package is not installed; do not add it.)
import { sql, getBooks } from "./db";
import { publicBook, visibleBook, type PublicBook } from "@/components/book-data";

export type Category = { slug: string; name: string; parent_slug: string | null; image_url: string | null; colour: string | null; sort: number };

export async function getCategories(): Promise<Category[]> {
  return await sql`select slug,name,parent_slug,image_url,colour,sort from categories
    where status='published' order by sort, name` as Category[];
}

export async function getStoreBooks(now: Date = new Date()): Promise<PublicBook[]> {
  return (await getBooks()).filter(visibleBook).map((book) => publicBook(book, now));
}

/** Real paid or fulfilled orders only; never a claim the data cannot support. */
export async function bestsellerSlugs(days = 90, limit = 12): Promise<string[]> {
  const rows = await sql`select item->>'slug' as slug, count(*)::int as n
    from orders, jsonb_array_elements(items) item
    where status in ('paid','fulfilled') and created_at > now() - make_interval(days => ${days})
    group by 1 order by n desc, slug limit ${limit}` as { slug: string }[];
  return rows.map((row) => row.slug);
}

export async function getPublishedAuthors() {
  return await sql`select id,name,photo_url from author_profiles
    where status='published' and (publish_at is null or publish_at <= now()) order by name` as { id: string; name: string; photo_url: string | null }[];
}
