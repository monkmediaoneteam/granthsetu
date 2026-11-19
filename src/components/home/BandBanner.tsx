import Link from "next/link";
import type { Banner } from "@/lib/home";

// A full-width image banner (Admin > Banners: wide band, book pages, search and category pages). Hidden until the admin adds one.
export default function BandBanner({ banner, wrapClass = "wrap section" }: { banner: Banner | null; wrapClass?: string }) {
  if (!banner?.image) return null;
  const art = <picture>
    {banner.mobileImage && <source media="(max-width: 640px)" srcSet={banner.mobileImage} />}
    <img src={banner.image} alt={banner.title} loading="lazy" />
  </picture>;
  const className = `band-banner${banner.mobileImage ? " has-mobile" : ""}`;
  return <section className={wrapClass} aria-label={banner.title}>
    {banner.href ? <Link href={banner.href} className={className}>{art}</Link> : <div className={className}>{art}</div>}
  </section>;
}
