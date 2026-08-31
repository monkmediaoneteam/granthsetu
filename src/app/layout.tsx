import type { Metadata } from "next";
import "./globals.css";
import { STORE } from "@/lib/store";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: STORE.name, template: `%s — ${STORE.name}` },
  description: STORE.tagline,
  openGraph: { type: "website", siteName: STORE.name, url: SITE },
  robots: { index: true, follow: true },
};

const LEGAL: [string, string][] = [
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
  ["Refunds", "/refund-policy"],
  ["Delivery", "/delivery-policy"],
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-2 focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>

        <header className="sticky top-0 z-50 border-b border-line bg-bg/85 backdrop-blur-md backdrop-saturate-150">
          <nav className="wrap flex min-h-[70px] items-center justify-between gap-6">
            <a href="/" className="title text-[17px] tracking-tight">
              {STORE.name}
            </a>
            <a className="eyebrow hover:text-ink" href="/#catalogue">
              Catalogue
            </a>
          </nav>
        </header>

        <main id="main">{children}</main>

        <footer className="mt-24 border-t border-line py-12">
          <div className="wrap flex flex-wrap items-start justify-between gap-8">
            <div>
              <p className="title mb-2 text-[16px]">{STORE.name}</p>
              {/* The seller has to be named: Razorpay requires it on the
                  policy pages, and it must match the account holder. */}
              <p className="eyebrow m-0">{STORE.legalEntity}</p>
            </div>
            <ul className="flex flex-wrap gap-6 text-sm text-ink-soft">
              {LEGAL.map(([label, href]) => (
                <li key={href}>
                  <a className="hover:text-ink hover:underline" href={href}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </footer>
      </body>
    </html>
  );
}
