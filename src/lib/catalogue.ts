import type { Book } from "./db";
import { siteUrl } from "./store";
import { saleable } from './access-policy';
export const isSaleable = saleable;

const absolute = (url: string) => url.startsWith("/") ? `${siteUrl()}${url}` : url;

// Structured data states only what the record holds; an offer appears only for a title on sale.
export function bookJsonLd(book: Book, url: string, saleable: boolean) {
  return {
    "@context": "https://schema.org", "@type": "Book", "@id": url, url, name: book.title,
    ...(book.subtitle && { alternativeHeadline: book.subtitle }),
    ...(book.description && { description: book.description }),
    ...(book.cover && { image: absolute(book.cover) }),
    ...(book.authorship && { author: { "@type": "Person", name: book.authorship } }),
    ...(book.publisher && { publisher: { "@type": "Organization", name: book.publisher } }),
    ...(book.isbn && { isbn: book.isbn }),
    ...(book.pages && { numberOfPages: book.pages }),
    ...(book.year && { datePublished: String(book.year) }),
    ...(book.language && { inLanguage: book.language }),
    ...(book.edition && { bookEdition: book.edition }),
    bookFormat: "https://schema.org/EBook",
    ...(saleable && book.price_inr > 0 && { offers: { "@type": "Offer", url, priceCurrency: "INR",
      price: (book.price_inr / 100).toFixed(2), availability: "https://schema.org/InStock" } }),
  };
}

// Inline <script> JSON must not be able to close its tag, start a comment, or end a JS line.
export function jsonLdHtml(data: unknown) {
  return JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}
