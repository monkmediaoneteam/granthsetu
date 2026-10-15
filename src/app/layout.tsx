import type { Metadata } from "next";
import "./globals.css";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
// Light weights of each script, for the outlined letterforms (unicode-range keeps unused scripts from downloading).
import "@fontsource/noto-sans-devanagari/300.css";
import "@fontsource/noto-sans-tamil/300.css";
import "@fontsource/noto-sans-bengali/300.css";
import "@fontsource/noto-sans-gujarati/300.css";
import "@fontsource/noto-sans-kannada/300.css";
import "@fontsource/noto-sans-telugu/300.css";
import { STORE, siteUrl } from "@/lib/store";
import CartProvider from "@/components/CartProvider";
import StoreHeader from "@/components/StoreHeader";
import SiteFooter from "@/components/SiteFooter";
import CartDrawer from "@/components/CartDrawer";
import { getCategories } from "@/lib/store-data";
import { getPublicContent } from "@/lib/content";
import { publicModules, contentUrl } from "@/components/content-data";
import { buildNav } from "@/lib/navigation";
import { getReader } from "@/lib/reader-auth";
import WishlistProvider from "@/components/WishlistProvider";
import Reveal from "@/components/motion/Reveal";

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
  const [{ nav, categories, announcement }, reader] = await Promise.all([frameData(), getReader().catch(() => null)]);
  return <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} /></head>
    <body><CartProvider><WishlistProvider signedIn={!!reader}>
    <a href="#main" className="skip-link" tabIndex={0}>Skip to content</a>
    <StoreHeader name={STORE.name} nav={nav} announcement={announcement} />
    <main id="main" tabIndex={-1}>{children}</main>
    <CartDrawer />
    <Reveal />
    <SiteFooter name={STORE.name} categories={categories} />
  </WishlistProvider></CartProvider></body></html>;
}
