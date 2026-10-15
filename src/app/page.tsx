import Link from "next/link";
import { ArrowRight, BookOpen, Download, Library, Plus, Send } from "lucide-react";
import { getBooks } from "@/lib/db";
import { getPublicContent } from "@/lib/content";
import { publicBook, visibleBook } from "@/components/book-data";
import Hero from "@/components/Hero";
import { Shelf } from "@/components/BookCard";
import ContentSections from "@/components/ContentSections";
import DiscoveryFeatures, { SubjectNavigation } from "@/components/DiscoveryFeatures";
import { publicModules } from "@/components/content-data";
import { siteUrl } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = { alternates: { canonical: siteUrl() } };

export default async function Home() {
  const [records, content] = await Promise.all([getBooks(), getPublicContent()]);
  const books = records.filter(visibleBook).map((book) => publicBook(book));
  const enabled = process.env.COMMERCE_ENABLED === "true";
  // Subject rails appear only once a subject can fill one; until then they would repeat the main shelf.
  const bySubject = new Map<string, typeof books>();
  for (const book of books) if (book.subject) bySubject.set(book.subject, [...bySubject.get(book.subject) || [], book]);
  const subjectShelves = [...bySubject].filter(([, items]) => items.length >= 3);
  return <>
    <Hero books={books} module={publicModules(content.modules).find((module) => module.type === "hero")} />
    <SubjectNavigation books={books} />
    <section className="section shelf-section" id="catalogue"><div className="wrap">
      <div className="section-heading"><div><p className="eyebrow">New in the reading room</p><h2>Find your next read.</h2></div>
        <Link href="/catalogue" className="text-link">All books <ArrowRight size={18} aria-hidden="true" /></Link>
      </div>
      {books.length ? <Shelf books={books.slice(0, 12)} enabled={enabled} label="New in the reading room" />
        : <p className="empty-state">The shelves are being prepared. Please check back for new digital editions.</p>}
    </div></section>
    {subjectShelves.map(([subject, items]) => <section className="section shelf-section" key={subject}><div className="wrap">
      <div className="section-heading"><div><p className="eyebrow">By subject</p><h2>{subject}</h2></div>
        <Link href={`/catalogue?subject=${encodeURIComponent(subject)}`} className="text-link">See all {items.length} <ArrowRight size={18} aria-hidden="true" /></Link>
      </div>
      <Shelf books={items.slice(0, 12)} enabled={enabled} label={subject} invite={false} />
    </div></section>)}
    <DiscoveryFeatures books={books} />
    <ContentSections {...content} modules={content.modules.filter((module) => module.type !== "author")} books={books} enabled={enabled} />
    <section className="section reader-services" id="delivery" aria-label="Reading and delivery"><div className="wrap">
      <div className="service-grid">
        <div><BookOpen size={25} strokeWidth={1.4} aria-hidden="true" /><h3>Digital editions</h3><p>Reference books for your reading device.</p><Link href="/catalogue">Browse the catalogue</Link></div>
        <div><Download size={25} strokeWidth={1.4} aria-hidden="true" /><h3>Your personal copy</h3><p>Download access with each fulfilled order.</p><Link href="/delivery-policy">Delivery & downloads</Link></div>
        <div><Library size={25} strokeWidth={1.4} aria-hidden="true" /><h3>Always on your shelf</h3><p>Your purchases and order history, together.</p><Link href="/library">Visit your library</Link></div>
      </div>
    </div></section>
    <section className="section publishing-invitation" id="publish"><img className="publishing-image" src="/assets/reading-room-campaign.webp" alt="" loading="lazy" /><div className="wrap publishing-inner">
      <div><p className="eyebrow">For authors and publishers</p><h2>Bring your work<br /><em>to the reading room.</em></h2></div>
      <div><p>Your research deserves readers. Introduce your book to our editorial team, from a first manuscript to an established reference work. We will guide you through review and rights clearance.</p>
        <Link className="btn btn-primary" href="/publish"><Send size={17} aria-hidden="true" /> Publish with us <ArrowRight size={17} aria-hidden="true" /></Link>
      </div>
    </div></section>
    <section className="section" id="faq"><div className="wrap faq-layout">
      <div><p className="eyebrow">Buying & reading</p><h2>A few things<br />worth knowing.</h2></div>
      <div className="faq-list">
        <details><summary>Are these printed books?<Plus size={18} aria-hidden="true" /></summary><p>These are digital editions. Nothing is shipped. Each book page lists the supplied format and bibliographic details.</p></details>
        <details><summary>How do I choose a book?<Plus size={18} aria-hidden="true" /></summary><p>Explore by subject, or search for a title or author. Each book page brings together its description, edition details, and availability so you can decide what belongs on your shelf.</p></details>
        <details><summary>How do I access a purchased book?<Plus size={18} aria-hidden="true" /></summary><p>After payment is confirmed and your order is fulfilled, access is provided through your order page and library. See our <Link href="/delivery-policy">delivery policy</Link> for download conditions.</p></details>
        <details><summary>Can I read a sample?<Plus size={18} aria-hidden="true" /></summary><p>A sample link appears on a book page only when a sample has been supplied. Not every edition includes one.</p></details>
        <details><summary>Can I share or return a digital copy?<Plus size={18} aria-hidden="true" /></summary><p>Digital editions are licensed for personal use. Downloaded books cannot be returned; file and delivery issues are covered by our <Link href="/refund-policy">refund policy</Link>.</p></details>
        <details><summary>How do I submit my own book?<Plus size={18} aria-hidden="true" /></summary><p>Visit <Link href="/publish">Publish with us</Link>, sign in with a verified email, and prepare your metadata, manuscript, and cover for review.</p></details>
      </div>
    </div></section>
  </>;
}
