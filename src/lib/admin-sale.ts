import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

// The database client is passed in so this logic runs the same against Neon and the offline test database.
type Sql = (parts: TemplateStringsArray, ...values: unknown[]) => Promise<Record<string, unknown>[]>;

export class SaleError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const MIN_BYTES = 1024;

// First-party books go on sale from admin: the server reads the file, records its checksum,
// marks the scan clean and the title released, and writes an audit event.
export async function putOnSale(sql: Sql, { slug, root }: { slug: string; root: string }) {
  const rows = await sql`select slug, price_inr, file_url, third_party from books where slug=${slug}`;
  const book = rows[0] as { price_inr: number; file_url: string | null; third_party: boolean | null } | undefined;
  if (!book) throw new SaleError("Book not found.", 404);
  if (book.third_party) throw new SaleError("Author books go on sale through their author submission review.", 409);
  if (!(book.price_inr > 0)) throw new SaleError("Set a regular price before putting the book on sale.");
  if (!book.file_url) throw new SaleError("Attach the book file before putting it on sale.");
  if (!book.file_url.startsWith("private:")) throw new SaleError("Only files stored in private/books can be put on sale from here.", 409);
  const file = book.file_url.slice(8);
  if (!/^[^\\/:]+$/.test(file) || file === "." || file === "..") throw new SaleError("The book's file name is invalid.");
  let bytes: Buffer;
  try { bytes = await readFile(path.join(root, "private", "books", file)); }
  catch { throw new SaleError(`private/books/${file} is missing from the deployment.`, 409); }
  if (bytes.length < MIN_BYTES) throw new SaleError(`${file} is a ${bytes.length}-byte placeholder. Upload the real PDF first.`, 409);
  const sha = createHash("sha256").update(bytes).digest("hex");
  const changed = await sql`with changed as (
    update books set file_sha256=${sha}, scan_status='clean', release_approved=true where slug=${slug} and not coalesce(third_party, false) returning slug
  ), audit as (insert into events(order_id,type,payload)
    select null,'admin.book.put_on_sale',jsonb_build_object('slug',slug,'file',${file}::text,'file_sha256',${sha}::text) from changed)
  select slug from changed`;
  if (changed.length !== 1) throw new SaleError("The book changed while saving. Reload and try again.", 409);
  return { sha };
}

// A price edit changes what is charged, not the file or rights, so the release stands.
export async function setRegularPrice(sql: Sql, { slug, rupees }: { slug: string; rupees: string }) {
  const paise = Math.round(Number(rupees) * 100);
  if (!/^\d+(?:\.\d{1,2})?$/.test(rupees) || !Number.isSafeInteger(paise) || paise <= 0 || paise > 100000000) throw new SaleError("Enter a price in rupees, like 1 or 249.50.");
  const rows = await sql`select sale_price_inr from books where slug=${slug}`;
  if (!rows.length) throw new SaleError("Book not found.", 404);
  const sale = rows[0].sale_price_inr as number | null;
  if (sale != null && sale >= paise) throw new SaleError("The regular price must stay above the sale price. Change the offer first.");
  await sql`with changed as (update books set price_inr=${paise} where slug=${slug} returning slug),
    audit as (insert into events(order_id,type,payload) select null,'admin.book.price',jsonb_build_object('slug',slug,'price_inr',${paise}::int) from changed)
    select slug from changed`;
}
