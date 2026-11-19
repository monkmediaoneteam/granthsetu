import Link from "next/link";
import type { Banner } from "@/lib/home";

// A full-width image banner lower on the homepage (Admin > Banners > Wide band). Hidden until the admin adds one.
export default function BandBanner({ banner }: { banner: Banner | null }) {
  if (!banner?.image) return null;
  const art = <picture>
    {banner.mobileImage && <source media="(max-width: 640px)" srcSet={banner.mobileImage} />}
    <img src={banner.image} alt={banner.title} loading="lazy" />
  </picture>;
  const className = `band-banner${banner.mobileImage ? " has-mobile" : ""}`;
  return <section className="wrap section" aria-label={banner.title}>
    {banner.href ? <Link href={banner.href} className={className}>{art}</Link> : <div className={className}>{art}</div>}
  </section>;
}
