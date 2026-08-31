import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
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

  /**
   * Book files live in /private, NEVER in /public — anything under /public is
   * served statically by Next and cannot be gated, so a file there is a free
   * download for anyone who guesses the filename.
   *
   * `private:<name>` reads from the bundled /private/books directory. A plain
   * https:// url is still supported for files kept in object storage.
   */
  let rawBytes: ArrayBuffer;

  if (book.file_url.startsWith("private:")) {
    const name = book.file_url.slice("private:".length);

    // Defeat path traversal: keep only the basename, then verify the resolved
    // path is still inside the books directory.
    const safe = path.basename(name);
    const dir = path.join(process.cwd(), "private", "books");
    const full = path.join(dir, safe);
    if (!full.startsWith(dir + path.sep)) {
      return NextResponse.json({ error: "Bad file reference." }, { status: 400 });
    }

    try {
      const buf = await readFile(full);
      rawBytes = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    } catch (err) {
      console.error("[download] private file missing", safe, err);
      return NextResponse.json({ error: "File not available yet." }, { status: 503 });
    }
  } else {
    const upstream = await fetch(book.file_url);
    if (!upstream.ok) {
      console.error("[download] upstream failed", book.file_url, upstream.status);
      return NextResponse.json({ error: "Could not fetch the file." }, { status: 502 });
    }
    rawBytes = await upstream.arrayBuffer();
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
    const stampText = `Licensed to ${order.email} · Order #${order.id} · INVENTAYU® Books`;
    const stamped = await stampPdf(rawBytes, stampText);
    body = Buffer.from(stamped);
  } else {
    body = Buffer.from(rawBytes);
  }

  return new NextResponse(body, {
    headers: {
      "content-type": contentType,
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
