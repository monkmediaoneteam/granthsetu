import { neon } from "@neondatabase/serverless";

/** Fail loudly on the unedited .env.example placeholder — otherwise this
 *  surfaces as a bare `getaddrinfo ENOTFOUND host`, which says nothing. */
function connectionString() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in."
    );
  }
  if (url.includes("user:password@") || /@host\//.test(url)) {
    throw new Error(
      "DATABASE_URL is still the .env.example placeholder. Paste the real Neon connection string into .env.local."
    );
  }
  return url;
}

/** Constructed lazily: the build collects page data without a database, so the
 *  placeholder check must fire on first query, not on import. */
let client: ReturnType<typeof neon> | null = null;

export const sql = ((...args: unknown[]) => {
  if (!client) client = neon(connectionString());
  return (client as (...a: unknown[]) => unknown)(...args);
}) as ReturnType<typeof neon>;

export type Book = {
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  cover: string | null;
  price_inr: number;
  file_url: string | null;
  file_format: string | null;
  file_size: string | null;
  isbn: string | null;
  publisher: string | null;
  pages: number | null;
  year: number | null;
  active: boolean;
};

export type OrderItem = { slug: string; title: string; price: number };

export type Order = {
  id: string;
  email: string;
  phone: string | null;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: "created" | "paid" | "fulfilled" | "payment_failed" | "refunded";
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  created_at: string;
  paid_at: string | null;
};

export async function getBooks(): Promise<Book[]> {
  return (await sql`
    select * from books where active = true order by sort, title
  `) as Book[];
}

export async function getBook(slug: string): Promise<Book | null> {
  const rows = (await sql`select * from books where slug = ${slug}`) as Book[];
  return rows[0] ?? null;
}

export async function getOrder(id: string): Promise<Order | null> {
  const rows = (await sql`select * from orders where id = ${id}`) as Order[];
  return rows[0] ?? null;
}

export async function logEvent(orderId: string | null, type: string, payload: unknown = {}) {
  await sql`
    insert into events (order_id, type, payload)
    values (${orderId}, ${type}, ${JSON.stringify(payload)}::jsonb)
  `;
}
