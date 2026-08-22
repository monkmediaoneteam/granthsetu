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

const BOOKS = [
  {
    slug: "researching-research-for-ayurveda",
    title: "Researching Research for Ayurveda",
    subtitle: "A Journey",
    description:
      "A book reflecting Dr. Bhatt's journey through research for Ayurveda, structured to provide depth and clarity on fundamentals, inquiry, experimentation and solution identification.",
    price_inr: 49900, // PLACEHOLDER ₹499
    publisher: null,
    pages: null,
    year: null,
    sort: 1,
  },
  {
    slug: "integrative-perspectives",
    title: "Integrative Perspectives",
    subtitle: "Ayurveda, Phytopharmaceuticals and Natural Products",
    description:
      "A landmark publication by IASTAM in association with Continental Prakashan, Pune, comprising 51 chapters by 41 well-known experts and IASTAM awardees; it explains integration in Ayurveda, especially drug standardization and regulatory aspects.",
    price_inr: 89900, // PLACEHOLDER ₹899
    publisher: "IASTAM · Continental Prakashan, Pune",
    pages: null,
    year: null,
    sort: 2,
  },
];

const run = async () => {
  console.log("Applying schema…");
  await sql(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));

  for (const b of BOOKS) {
    await sql`
      insert into books (slug, title, subtitle, description, price_inr, publisher, pages, year, sort, file_format)
      values (${b.slug}, ${b.title}, ${b.subtitle}, ${b.description}, ${b.price_inr},
              ${b.publisher}, ${b.pages}, ${b.year}, ${b.sort}, 'PDF')
      on conflict (slug) do update set
        title = excluded.title,
        subtitle = excluded.subtitle,
        description = excluded.description,
        publisher = excluded.publisher,
        sort = excluded.sort
    `;
    console.log("  seeded", b.slug);
  }

  console.log("\nDone. Prices and files are PLACEHOLDERS — replace before launch.");
};

run().catch((e) => { console.error(e); process.exit(1); });
