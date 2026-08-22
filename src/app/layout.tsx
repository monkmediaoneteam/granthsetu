import type { Metadata } from "next";
import "./globals.css";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://books.inventayu.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Books by Dr. Narendra Bhatt \u2014 INVENTAYU\u00AE",
    template: "%s \u2014 INVENTAYU\u00AE Books",
  },
  description:
    "Digital editions of Dr. Narendra Bhatt's work on Ayurveda research, integrative perspectives and translational methodology.",
  openGraph: { type: "website", siteName: "INVENTAYU\u00AE Books", url: SITE },
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
          <nav className="wrap flex min-h-[74px] items-center justify-between gap-6">
            <a href="/" className="font-semibold tracking-tight">
              INVENTAYU<sup className="text-[10px]">&reg;</sup>
              <span className="eyebrow ml-1.5">Books</span>
            </a>
            <a
              className="eyebrow hover:text-ink"
              href="https://www.inventayu.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              Main site <span aria-hidden>&rarr;</span>
            </a>
          </nav>
        </header>

        <main id="main">{children}</main>

        <footer className="mt-24 border-t border-line py-12">
          <div className="wrap">
            <p className="eyebrow mb-4">
              INVENTAYU Pvt. Ltd. &middot; Registered Start-Up &middot; MSME
            </p>
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
