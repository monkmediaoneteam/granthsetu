import { NextResponse } from "next/server";
import { sql, getBook, getOrder, logEvent } from "@/lib/db";
import { verifyDownloadToken } from "@/lib/token";
import { stampPdf } from "@/lib/pdf";

export const runtime = "nodejs";

const MAX_DOWNLOADS = 10;

/**
 * The only door to the file. Streams through the server rather than redirecting
 * to storage, so the counter cannot be bypassed and the storage URL never leaks.
 * Stamps the PDF footer with the buyer's email and order ID.
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
  if (!upstream.ok) {
    console.error("[download] upstream failed", fileUrl, upstream.status);
    return NextResponse.json({ error: "Could not fetch the file." }, { status: 502 });
  }

  await sql`
    update downloads set count = count + 1, last_at = now()
    where order_id = ${claim.orderId} and book_slug = ${claim.slug}
  `;
  await logEvent(claim.orderId, "download", {
    slug: claim.slug,
    ip: req.headers.get("x-forwarded-for") || "unknown",
    ua: req.headers.get("user-agent") || "unknown",
  });

  const format = (book.file_format || "pdf").toLowerCase();
  const filename = `${book.slug}.${format}`;
  const contentType = format === "epub" ? "application/epub+zip" : "application/pdf";

  let body: BodyInit;
  if (format === "pdf") {
    const rawBytes = await upstream.arrayBuffer();
    const stampText = `Licensed to ${order.email} · Order #${order.id} · INVENTAYU® Books`;
    const stamped = await stampPdf(rawBytes, stampText);
    body = Buffer.from(stamped);
  } else {
    body = (await upstream.blob()) as unknown as BodyInit;
  }

  return new NextResponse(body, {
    headers: {
      "content-type": contentType,
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
