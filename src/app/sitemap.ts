import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://books.inventayu.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["", "/privacy", "/terms", "/refund-policy", "/delivery-policy"];
  return paths.map((p) => ({
    url: `${SITE}${p}`,
    lastModified: new Date(),
    priority: p === "" ? 1 : 0.4,
  }));
}
