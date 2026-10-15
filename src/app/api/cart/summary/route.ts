import { NextResponse } from "next/server";
import { getBook } from "@/lib/db";
import { checkOrigin } from "@/lib/reader-auth";
import { publicBook, visibleBook } from "@/components/book-data";

export const runtime = "nodejs";
const SLUG = /^[a-z0-9][a-z0-9_-]{0,100}$/;

export async function POST(req: Request) {
  if (!checkOrigin(req)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  let slugs: unknown;
  try { const text = await req.text(); if (text.length > 4000) throw new Error(); slugs = JSON.parse(text)?.slugs; } catch { return NextResponse.json({ error: "Bad request." }, { status: 400 }); }
  if (!Array.isArray(slugs) || slugs.length > 20 || slugs.some((s) => typeof s !== "string" || !SLUG.test(s))) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const now = new Date();
  const rows = await Promise.all([...new Set(slugs as string[])].map(getBook));
  const books = rows.flatMap((b) => b && visibleBook(b) ? [publicBook(b, now)] : [])
    .map(({ slug, title, cover, authorship, price, regular, onSale, saleable }) => ({ slug, title, cover, authorship, price, regular, onSale, saleable }));
  return NextResponse.json({ books }, { headers: { "cache-control": "no-store" } });
}
