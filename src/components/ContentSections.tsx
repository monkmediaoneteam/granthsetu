import Link from "next/link";
import { ArrowRight, ArrowUpRight, Quote } from "lucide-react";
import type { ContentModule, Collection, AuthorProfile } from "@/lib/content";
import type { PublicBook } from "./book-data";
import { contentUrl, publicModules, videoUrl } from "./content-data";
import BookCard from "./BookCard";

export default function ContentSections({ modules, collections, authors, books, enabled }: {
  modules: ContentModule[]; collections: Collection[]; authors: AuthorProfile[]; books: PublicBook[]; enabled: boolean;
}) {
  const ordered = publicModules(modules);
  const available = collections.filter((collection) => collection.book_slugs.some((slug) => books.some((book) => book.slug === slug)));
  const referenced = new Set(ordered.filter((module) => module.type === "collection").map((module) => module.payload.collection_slug));
  const remaining = available.filter((collection) => !referenced.has(collection.slug));
  return <>
    {ordered.map((module) => {
      if (module.type === "hero") return null;
      const image = contentUrl(module.image_url);
      const mobileImage = contentUrl(module.mobile_image_url);
      const href = contentUrl(module.link_url);
      if (module.type === "collection") {
        const collection = available.find((item) => item.slug === module.payload.collection_slug);
        if (!collection) return null;
        const selected = collection.book_slugs.flatMap((slug) => books.filter((book) => book.slug === slug));
        const cover = image || contentUrl(collection.image_url);
        return <section className="section collection-section" key={module.id}><div className="wrap">
          <div className="section-heading"><div><p className="eyebrow">A curated shelf</p><h2>{module.title || collection.title}</h2>
            {(module.body || collection.description) && <p className="muted preserve-lines">{module.body || collection.description}</p>}</div>
            {cover && <img src={cover} alt={collection.title} loading="lazy" className="collection-image" />}
            <Link className="text-link" href={`/catalogue?collection=${encodeURIComponent(collection.slug)}`}>{module.link_label || "View collection"} <ArrowRight size={18} aria-hidden="true" /></Link>
          </div>
          {books.length > 2 && <div className="book-grid">{selected.map((book, index) => <BookCard book={book} index={index} enabled={enabled} key={book.slug} />)}</div>}
        </div></section>;
      }
      if (module.type === "author") {
        const author = authors.find((item) => item.id === module.payload.author_id);
        const photo = contentUrl(author?.photo_url);
        if (!author || (!author.bio && !photo)) return null;
        return <section className="section author-section" key={module.id}><div className="wrap editorial-feature">
          {photo && <img src={photo} alt={author.name} className="author-photo" loading="lazy" />}
          <div><p className="eyebrow">The people behind the pages</p><h2>{author.name}</h2>{author.bio && <p className="preserve-lines">{author.bio}</p>}
            {href && <Link href={href} className="text-link">{module.link_label || "Read more"}<ArrowUpRight size={18} aria-hidden="true" /></Link>}</div>
        </div></section>;
      }
      if (module.type === "testimonial") {
        const quote = typeof module.payload.quote === "string" ? module.payload.quote : module.body;
        const attribution = typeof module.payload.attribution === "string" ? module.payload.attribution : null;
        if (!quote?.trim() || !attribution?.trim()) return null;
        return <section className="section testimonial-section" key={module.id}><div className="wrap">
          <p className="eyebrow">{module.title}</p><Quote size={30} strokeWidth={1.3} aria-hidden="true" />
          <figure><blockquote>{quote}</blockquote><figcaption>{attribution}</figcaption></figure>
        </div></section>;
      }
      const video = module.type === "media" ? videoUrl(module.payload.video_url) || videoUrl(module.link_url) : null;
      if (!module.body && !image && !video) return null;
      return <section key={module.id} className={`section content-section content-${module.type}`}><div className="wrap editorial-feature">
        {video ? <video className="editorial-video" src={video} poster={image || undefined} controls playsInline preload="none" aria-label={module.title}>
          <a href={video}>Open {module.title}</a>
        </video> : image && <picture>{mobileImage && <source media="(max-width: 640px)" srcSet={mobileImage} />}<img src={image} alt={module.title} loading="lazy" className="editorial-image" /></picture>}
        <div><p className="eyebrow">{module.type === "media" ? "In conversation" : "From the reading room"}</p>
          <h2>{module.title}</h2>{module.body && <p className="preserve-lines">{module.body}</p>}
          {href && <Link href={href} className="text-link">{module.link_label || (video ? "Open video" : "Read more")}<ArrowUpRight size={18} aria-hidden="true" /></Link>}
        </div>
      </div></section>;
    })}
    {remaining.length > 0 && <section className="section collection-section"><div className="wrap">
      <div className="section-heading"><div><p className="eyebrow">Curated shelves</p><h2>Browse by collection.</h2></div></div>
      <ul className="collection-links">{remaining.map((collection) => <li key={collection.slug}>
        <Link href={`/catalogue?collection=${encodeURIComponent(collection.slug)}`}><span>{collection.title}</span><ArrowUpRight size={20} aria-hidden="true" /></Link>
        {collection.description && <p>{collection.description}</p>}
      </li>)}</ul>
    </div></section>}
  </>;
}
