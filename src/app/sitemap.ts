import type { MetadataRoute } from "next";

import { siteUrl } from '@/lib/store';
import { getBooks } from '@/lib/db';
import { visibleBook } from '@/components/book-data';
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const paths = ["", '/catalogue', '/publish', "/privacy", "/terms", "/refund-policy", "/delivery-policy",
    ...(await getBooks()).filter(visibleBook).map(book => `/books/${encodeURIComponent(book.slug)}`)];
  return paths.map((p) => ({
    url: `${siteUrl()}${p}`,
    lastModified: new Date(),
    priority: p === "" ? 1 : 0.4,
  }));
}
