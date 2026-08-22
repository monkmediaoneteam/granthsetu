import { NextResponse } from "next/server";
import { sql, getBook, getOrder, logEvent } from "@/lib/db";
import { verifyDownloadToken } from "@/lib/token";

export const runtime = "nodejs";

const MAX_DOWNLOADS = 10;

/**
 * The only door to the file. Streams through the server rather than redirecting
 * to storage, so the counter cannot be bypassed and the storage URL never leaks.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t") || "";
  const claim = verifyDownloadToken(token);

  if (!claim) {
    return NextResponse.json(
      { error: "This link has expired. Reopen your order page for a fresh one." },
      { status: 403 }
    );
  }

  const order = await getOrder(claim.orderId);
  if (!order || (order.status !== "paid" && order.status !== "fulfilled")) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  if (!order.items.some((i) => i.slug === claim.slug)) {
    return NextResponse.json({ error: "Not part of this order." }, { status: 403 });
  }

  const counts = (await sql`
    select count from downloads
    where order_id = ${claim.orderId} and book_slug = ${claim.slug}
  `) as { count: number }[];

  if ((counts[0]?.count ?? 0) >= MAX_DOWNLOADS) {
    return NextResponse.json(
      { error: "Download limit reached. Please write to us and we will help." },
      { status: 429 }
    );
  }

  const book = await getBook(claim.slug);
  if (!book?.file_url) {
    return NextResponse.json({ error: "File not available yet." }, { status: 503 });
  }

  // file_url may be relative (the placeholder sample lives in /public).
  const fileUrl = book.file_url.startsWith("http")
    ? book.file_url
    : new URL(book.file_url, req.url).toString();

  const upstream = await fetch(fileUrl);
  if (!upstream.ok || !upstream.body) {
    console.error("[download] upstream failed", fileUrl, upstream.status);
    return NextResponse.json({ error: "Could not fetch the file." }, { status: 502 });
  }

  await sql`
    update downloads set count = count + 1, last_at = now()
    where order_id = ${claim.orderId} and book_slug = ${claim.slug}
  `;
  await logEvent(claim.orderId, "download", {
    slug: claim.slug,
    ip: req.headers.get("x-forwarded-for"),
    ua: req.headers.get("user-agent"),
  });

  // ponytail: serving the master file as-is. Per-buyer footer stamping (PRD §2)
  // needs pdf-lib and the real PDFs — wire it here once the files land.
  const filename = `${book.slug}.${(book.file_format || "pdf").toLowerCase()}`;

  return new NextResponse(upstream.body, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
