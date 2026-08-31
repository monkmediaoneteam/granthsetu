import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { sql, logEvent } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

/** Book content editing. Prices are in rupees on the wire, paise in the DB. */
export async function POST(req: Request) {
  const form = await req.formData();
  const token = String(form.get("token") || "");
  if (!(await isAdmin(token || undefined))) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const slug = String(form.get("slug") || "");
  if (!slug) return NextResponse.json({ error: "Missing slug." }, { status: 400 });

  const priceRupees = Number(form.get("price_inr"));
  if (!Number.isFinite(priceRupees) || priceRupees < 0) {
    return NextResponse.json({ error: "Invalid price." }, { status: 400 });
  }

  const highlights = String(form.get("highlights") || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // "Key: Value" per line -> jsonb object, order preserved.
  const facts: Record<string, string> = {};
  for (const line of String(form.get("facts") || "").split("\n")) {
    const i = line.indexOf(":");
    if (i < 1) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (k && v) facts[k] = v;
  }

  const pages = Number(form.get("pages")) || null;
  const year = Number(form.get("year")) || null;

  await sql`
    update books set
      title            = ${String(form.get("title") || "")},
      subtitle         = ${String(form.get("subtitle") || "") || null},
      description      = ${String(form.get("description") || "") || null},
      long_description = ${String(form.get("long_description") || "") || null},
      highlights       = ${JSON.stringify(highlights)}::jsonb,
      facts            = ${JSON.stringify(facts)}::jsonb,
      authorship       = ${String(form.get("authorship") || "") || null},
      price_inr        = ${Math.round(priceRupees * 100)},
      publisher        = ${String(form.get("publisher") || "") || null},
      isbn             = ${String(form.get("isbn") || "") || null},
      pages            = ${pages},
      year             = ${year},
      cover            = ${String(form.get("cover") || "") || null},
      file_url         = ${String(form.get("file_url") || "") || null},
      active           = ${form.get("active") === "on"}
    where slug = ${slug}
  `;

  await logEvent(null, "admin.book.updated", { slug });
  revalidatePath("/");

  return NextResponse.redirect(
    new URL(`/admin/books?saved=${slug}`, req.url),
    303
  );
}
