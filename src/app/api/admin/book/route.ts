import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";
import { checkOrigin } from '@/lib/reader-auth';
import { PublishingError, readLimitedForm, releaseExistingBook } from '@/lib/submissions';
import { ContentError, safeUrl, textField } from '@/lib/content';

export const runtime = "nodejs";

/** Book content editing. Prices are in rupees on the wire, paise in the DB. */
export async function POST(req: Request) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'Not authorised.' }, { status: 403 });
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  try {
    const form = await readLimitedForm(req, 200000);
    const slug = textField(form.get('slug'), 101, true);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new PublishingError('Invalid book slug.');
    const action = form.get('action') ?? 'save';
    const allowed = action === 'release'
      ? ['action', 'slug', 'submission_id', 'reason', 'confirmed']
      : action === 'archive' || action === 'restore'
      ? ['action', 'slug', 'reason', 'confirmed']
      : ['action', 'slug', 'title', 'subtitle', 'price_inr', 'publisher', 'isbn', 'pages', 'year', 'cover', 'description', 'long_description', 'authorship', 'facts', 'highlights', 'active'];
    if (!['save', 'release', 'archive', 'restore'].includes(String(action)) || [...form.keys()].some(key => !allowed.includes(key) || form.getAll(key).length !== 1)) throw new PublishingError('Invalid book fields.');
    if (action === 'release') {
      await releaseExistingBook(textField(form.get('submission_id'), 120, true), slug, textField(form.get('reason'), 2000, true), form.get('confirmed') === 'on');
    } else if (action === 'archive' || action === 'restore') {
      const reason = textField(form.get('reason'), 2000, true);
      if (reason.length < 10 || form.get('confirmed') !== 'on') throw new PublishingError('A reason and explicit confirmation are required.');
      const rows = await sql`with changed as (
        update books set active=${action === 'restore'} where slug=${slug} and third_party returning slug,submission_id,release_approved
      ), audit as (insert into events(order_id,type,payload)
        select null,${action === 'archive' ? 'admin.book.archived' : 'admin.book.restored'},
          jsonb_build_object('slug',slug,'submission_id',submission_id,'release_approved',release_approved,'reason',${reason}::text) from changed)
      select slug from changed`;
      if (!rows.length) throw new PublishingError('Visibility actions require an existing third-party publication.', 409);
    } else {
      const books = await sql`select third_party from books where slug=${slug}`;
      if (!books.length) throw new PublishingError('Book not found.', 404);
      if (books[0].third_party) throw new PublishingError('Author publication changes require a new reviewed submission. Only visibility can be changed here.', 409);
      const title = textField(form.get('title'), 200, true);
      const subtitle = textField(form.get('subtitle'), 200);
      const description = textField(form.get('description'), 20000);
      const longDescription = textField(form.get('long_description'), 40000);
      const authorship = textField(form.get('authorship'), 500);
      const publisher = textField(form.get('publisher'), 200);
      const isbn = textField(form.get('isbn'), 32);
      if (isbn && !/^[0-9Xx -]+$/.test(isbn)) throw new PublishingError('Invalid ISBN.');
      const cover = safeUrl(form.get('cover'));
      const price = textField(form.get('price_inr'), 20, true);
      const pricePaise = Math.round(Number(price) * 100);
      if (!/^\d+(?:\.\d{1,2})?$/.test(price) || !Number.isSafeInteger(pricePaise) || pricePaise < 0 || pricePaise > 100000000) throw new PublishingError('Invalid price.');
      const integer = (name: string, max: number) => {
        const value = textField(form.get(name), 10);
        if (!value) return null;
        const number = Number(value);
        if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < 1 || number > max) throw new PublishingError(`Invalid ${name}.`);
        return number;
      };
      const pages = integer('pages', 100000);
      const year = integer('year', 9999);
      const highlights = textField(form.get('highlights'), 10000)
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      const facts: Record<string, string> = Object.create(null);
      for (const line of textField(form.get('facts'), 10000).split("\n").filter(line => line.trim())) {
        const i = line.indexOf(":");
        if (i < 1) throw new PublishingError('Facts require Key: Value.');
        const k = line.slice(0, i).trim();
        const v = line.slice(i + 1).trim();
        if (!k || !v || k.startsWith('_') || k.length > 200 || v.length > 2000) throw new PublishingError('Invalid catalogue fact.');
        facts[k] = v;
      }

      const rows = await sql`with changed as (
        update books set
          title            = ${title},
          subtitle         = ${subtitle || null},
          description      = ${description || null},
          long_description = ${longDescription || null},
          highlights       = ${JSON.stringify(highlights)}::jsonb,
          -- Internal facts survive edits; public facts come from the current form.
          facts            = (
            select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
            from jsonb_each(coalesce(books.facts, '{}'::jsonb)) as t(k, v)
            where left(k,1) = '_'
          ) || ${JSON.stringify(facts)}::jsonb,
          authorship       = ${authorship || null},
          price_inr        = ${pricePaise},
          publisher        = ${publisher || null},
          isbn             = ${isbn || null},
          pages            = ${pages},
          year             = ${year},
          cover            = ${cover},
          release_approved = false,
          active           = ${form.get("active") === "on"}
        where slug = ${slug} and not third_party returning slug
      ), audit as (insert into events(order_id,type,payload)
        select null,'admin.book.updated',jsonb_build_object('slug',slug) from changed)
      select slug from changed`;
      if (!rows.length) throw new PublishingError('Book not found.', 404);
    }
    revalidatePath("/");
    revalidatePath('/catalogue');
    revalidatePath(`/books/${slug}`);
    revalidatePath('/admin/books');

    return NextResponse.redirect(new URL(`/admin/books?saved=${encodeURIComponent(slug)}`, req.url), 303);
  } catch (error) {
    if (error instanceof PublishingError || error instanceof ContentError) return NextResponse.json({ error: error.message }, { status: error instanceof PublishingError ? error.status : 400 });
    console.error('Admin book update failed', error);
    return NextResponse.json({ error: 'Could not save the book.' }, { status: 503 });
  }
}
