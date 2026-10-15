import type { Metadata } from "next";
import "./globals.css";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/inter";
import { STORE, siteUrl } from "@/lib/store";
import CartProvider from "@/components/CartProvider";
import StoreHeader from "@/components/StoreHeader";
import SiteFooter from "@/components/SiteFooter";
import { getCategories } from "@/lib/store-data";
import { getPublicContent } from "@/lib/content";
import { publicModules, contentUrl } from "@/components/content-data";
import { buildNav } from "@/lib/navigation";

const SITE = siteUrl();
export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: STORE.name, template: `%s | ${STORE.name}` },
  description: STORE.tagline,
  openGraph: { type: "website", siteName: STORE.name, url: SITE },
  robots: { index: true, follow: true },
};

// A database error must never take down every page: the frame falls back to an empty menu.
async function frameData() {
  try {
    const [categories, content] = await Promise.all([getCategories(), getPublicContent()]);
    const announcement = publicModules(content.modules).find((m) => m.type === "announcement") ?? null;
    return { nav: buildNav(categories), categories, announcement: announcement && { title: announcement.title, link_url: contentUrl(announcement.link_url) } };
  } catch { console.error("[layout] storefront frame data unavailable"); return { nav: { primary: [], more: [] }, categories: [], announcement: null }; }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { nav, categories, announcement } = await frameData();
  return <html lang="en" data-scroll-behavior="smooth"><body><CartProvider>
    <a href="#main" className="skip-link" tabIndex={0}>Skip to content</a>
    <StoreHeader name={STORE.name} nav={nav} announcement={announcement} />
    <main id="main" tabIndex={-1}>{children}</main>
    <SiteFooter name={STORE.name} categories={categories} />
  </CartProvider></body></html>;
}
