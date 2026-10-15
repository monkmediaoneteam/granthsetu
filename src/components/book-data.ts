import type { Book } from "@/lib/db";
import { isSaleable } from "@/lib/catalogue";

export type ReadingBook = Book;

export function visibleBook(book: Book) {
  return book.active && (!book.third_party || isSaleable(book));
}

export type PublicBook = Pick<ReadingBook,
  "slug" | "title" | "subtitle" | "description" | "authorship" | "cover" |
  "price_inr" | "file_format" | "pages" | "year" | "subject" | "language" | "edition" | "author_slug" | "isbn"
> & { highlights: string[]; saleable: boolean; saveable: boolean };

// Only public bibliographic fields cross the client boundary, never file URLs.
export function publicBook(book: ReadingBook): PublicBook {
  const { slug, title, subtitle, description, authorship, cover, price_inr,
    file_format, pages, year, subject, language, edition, author_slug, isbn } = book;
  return { slug, title, subtitle, description, authorship, cover, price_inr,
    file_format, pages, year, subject: subject || book.facts?.Subject || null,
    language: language || book.facts?.Language || null, edition: edition || book.facts?.Edition || null, author_slug, isbn,
    highlights: Array.isArray(book.highlights) ? book.highlights : [],
    saleable: isSaleable(book), saveable: visibleBook(book) };
}
