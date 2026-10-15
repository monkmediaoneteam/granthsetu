import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { STORE } from "@/lib/store";
import type { PublicBook } from "./book-data";
import type { ContentModule } from "@/lib/content";
import { contentUrl, publicModules } from "./content-data";
import MotionBookLink from "./MotionBookLink";

export default function Hero({ books, module }: { books: PublicBook[]; module?: ContentModule }) {
  const settings = module && publicModules([module]).find((item) => item.type === "hero");
  const title = settings?.title || (STORE.name.includes(" by ") ? STORE.name.split(" by ")[0] : STORE.name);
  const subtitle = settings && typeof settings.payload.subtitle === "string" ? settings.payload.subtitle : null;
  const image = contentUrl(settings?.image_url) || "/assets/reading-room-botanical-v2.webp";
  const mobileImage = contentUrl(settings?.mobile_image_url);
  const href = contentUrl(settings?.link_url) || "/catalogue";
  const shown = books.filter((book) => book.cover).slice(0, 2);
  return <section className={`reading-hero${settings ? " hero-custom" : ""}${title.length > 90 ? " hero-long-title" : ""}`}>
    <picture className="hero-editorial-media">{mobileImage && <source media="(max-width: 640px)" srcSet={mobileImage} />}<img src={image} alt="" className="hero-editorial-image" fetchPriority="high" /></picture>
    <div className="wrap hero-inner">
      <div className="hero-copy">
        <p className="eyebrow"><span className="edition-marker" /> {STORE.kicker}</p>
        <h1>{title}</h1>
        {settings ? subtitle && <p className="hero-deck">{subtitle}</p> : <p className="hero-deck">Rooted in Ayurveda.<br /><em>Open to discovery.</em></p>}
        <p className="hero-description preserve-lines">{settings?.body || "Explore books on research, natural products, and the ideas connecting tradition with science."}</p>
        <Link href={href} className="btn btn-primary">{settings?.link_label || "Browse books"} <ArrowRight size={18} aria-hidden="true" /></Link>
      </div>
      {shown.length > 0 && <div className="hero-books" aria-label="Featured digital editions">
        {shown.map((book, index) => <MotionBookLink key={book.slug} href={`/books/${encodeURIComponent(book.slug)}`} className="hero-volume">
          <Image src={book.cover!} unoptimized={book.cover!.startsWith("https://")} alt={`Cover of ${book.title}`} width={1120} height={1400} preload
            sizes="(max-width: 640px) 47vw, (max-width: 1000px) 32vw, 350px" />
          <span className="hero-volume-label"><span>{String(index + 1).padStart(2, "0")}</span>{book.title}</span>
        </MotionBookLink>)}
      </div>}
      <div className="hero-foot"><span><BookOpen size={17} aria-hidden="true" /> A shelf for curious minds</span><span>{books.length} {books.length === 1 ? "digital edition" : "digital editions"}<ArrowRight size={17} aria-hidden="true" /></span></div>
    </div>
  </section>;
}
