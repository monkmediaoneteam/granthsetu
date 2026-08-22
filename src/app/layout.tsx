import type { Metadata } from "next";
import "./globals.css";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://books.inventayu.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Books by Dr. Narendra Bhatt — INVENTAYU®",
    template: "%s — INVENTAYU® Books",
  },
  description:
    "Digital editions of Dr. Narendra Bhatt's work on Ayurveda research, integrative perspectives and translational methodology.",
  openGraph: { type: "website", siteName: "INVENTAYU® Books", url: SITE },
  robots: { index: true, follow: true },
};

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
        <nav className="nav-top">
          <div className="wrap nav-inner">
            <a href="/" style={{ fontWeight: 600, letterSpacing: "-0.02em" }}>
              INVENTAYU<sup style={{ fontSize: 10 }}>®</sup>{" "}
              <span className="eyebrow" style={{ marginLeft: 6 }}>Books</span>
            </a>
            <a className="eyebrow" href="https://www.inventayu.com" target="_blank" rel="noopener">
              Main site →
            </a>
          </div>
        </nav>
        {children}
        <footer style={{ borderTop: "1px solid var(--line)", marginTop: 96, padding: "48px 0" }}>
          <div className="wrap">
            <div className="eyebrow" style={{ marginBottom: 16 }}>
              INVENTAYU Pvt. Ltd. · Registered Start-Up · MSME
            </div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontSize: 14, color: "var(--ink-soft)" }}>
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
              <a href="/refund-policy">Refunds</a>
              <a href="/delivery-policy">Delivery</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
