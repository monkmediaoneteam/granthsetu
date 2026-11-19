import Link from "next/link";
import type { Banner } from "@/lib/home";

// The two cards beside the hero: each shows the admin's banner image for that slot (Admin > Banners > Side card 1 / 2),
// linked if a link is set. Until one is added, a plain placeholder image keeps the layout.
function Slot({ banner, slot }: { banner: Banner | null; slot: "1" | "2" }) {
  const art = <picture className="side-image">
    {banner?.mobileImage && <source media="(max-width: 640px)" srcSet={banner.mobileImage} />}
    <img src={banner?.image ?? `/api/placeholder/side?slot=${slot}`} alt={banner?.title ?? ""} loading="lazy" />
  </picture>;
  return banner?.href ? <Link href={banner.href} className="side-card side-slot" aria-label={banner.title}>{art}</Link>
    : <div className="side-card side-slot">{art}</div>;
}

export default function HomeSide({ banners }: { banners: { first: Banner | null; second: Banner | null } }) {
  return <aside className="home-side" aria-label="Promotions">
    <Slot banner={banners.first} slot="1" />
    <Slot banner={banners.second} slot="2" />
  </aside>;
}
