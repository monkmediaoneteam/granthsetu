import { neon } from "@neondatabase/serverless";

export const sql = neon(process.env.DATABASE_URL!);

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
