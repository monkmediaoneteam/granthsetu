import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BookOpen } from "lucide-react";
import "./globals.css";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/manrope";
import { STORE, siteUrl } from "@/lib/store";
import CartProvider from "@/components/CartProvider";
import StoreHeader from "@/components/StoreHeader";

const SITE = siteUrl();
export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: STORE.name, template: `%s | ${STORE.name}` },
  description: STORE.tagline,
  openGraph: { type: "website", siteName: STORE.name, url: SITE },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" data-scroll-behavior="smooth"><body><CartProvider>
    <a href="#main" className="skip-link" tabIndex={0}>Skip to content</a>
    <StoreHeader name={STORE.name} />
    <main id="main" tabIndex={-1}>{children}</main>
    <footer className="store-footer"><div className="wrap footer-grid">
      <div><Link className="footer-brand" href="/"><BookOpen size={32} strokeWidth={1.8} aria-hidden="true" /><span>{STORE.name.includes(" by ") ? <>{STORE.name.split(" by ")[0]}<small>by {STORE.name.split(" by ").slice(1).join(" by ")}</small></> : STORE.name}</span></Link>
        <p>Books, research, and curious minds.</p>
      </div>
      <div><p className="eyebrow">Explore</p><Link href="/catalogue">Catalogue</Link><Link href="/library">My library</Link><Link href="/publish">Publish with us <ArrowUpRight size={14} aria-hidden="true" /></Link></div>
      <div><p className="eyebrow">The details</p>{[["Privacy", "/privacy"], ["Terms", "/terms"], ["Refunds", "/refund-policy"], ["Delivery", "/delivery-policy"]].map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</div>
    </div><div className="wrap footer-bottom"><span>{STORE.name}</span><span>Digital books. Lasting ideas.</span></div></footer>
  </CartProvider></body></html>;
}
