/**
 * Placeholder catalogue. Every value here is a guess except the titles and the
 * IASTAM description, which come from the main INVENTAYU site.
 * Replace prices, covers, file_url, isbn, pages and year with the real ones.
 *
 *   node --env-file=.env.local scripts/seed.mjs
 */
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

const DB = process.env.DATABASE_URL;
if (!DB || DB.includes("user:password@") || /@host\//.test(DB)) {
  console.error(
    [
      "",
      "DATABASE_URL is missing or still the .env.example placeholder.",
      "Create a Neon project, then paste its connection string into .env.local.",
      "",
    ].join("\n")
  );
  process.exit(1);
}

const sql = neon(DB);

const BOOKS = JSON.parse(
  readFileSync(new URL("./books.json", import.meta.url), "utf8")
);


const run = async () => {
  console.log("Applying schema…");
  // Neon's HTTP driver runs one statement per call, so split the file.
  const schema = readFileSync(new URL("../schema.sql", import.meta.url), "utf8")
    .replace(/^\s*--.*$/gm, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of schema) await sql(stmt);
  console.log(`  ${schema.length} statements applied`);

  for (const b of BOOKS) {
    await sql`
      insert into books (slug, title, subtitle, description, long_description, highlights,
                         cover, price_inr, publisher, pages, year, sort, file_format, file_url)
      values (${b.slug}, ${b.title}, ${b.subtitle}, ${b.description}, ${b.long_description},
              ${JSON.stringify(b.highlights)}::jsonb, ${b.cover}, ${b.price_inr},
              ${b.publisher}, ${b.pages}, ${b.year}, ${b.sort}, 'PDF', '/sample.pdf')
      on conflict (slug) do update set
        title = excluded.title,
        subtitle = excluded.subtitle,
        description = excluded.description,
        long_description = excluded.long_description,
        highlights = excluded.highlights,
        cover = excluded.cover,
        publisher = excluded.publisher,
        sort = excluded.sort,
        file_url = coalesce(books.file_url, excluded.file_url)
    `;
    console.log("  seeded", b.slug);
  }

  console.log("\nDone. Prices and files are PLACEHOLDERS replace before launch.");
};

run().catch((e) => { console.error(e); process.exit(1); });
