import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/admin-auth";
import { checkOrigin } from "@/lib/reader-auth";
import { contentSections, saveContent, deleteContent, ContentError, type ContentSection } from "@/lib/content";
import { readLimitedForm, PublishingError } from "@/lib/submissions";

export const runtime = "nodejs";
export async function POST(req: Request) {
  if (!checkOrigin(req)) return NextResponse.json({ error: "Origin rejected." }, { status: 403 });
  if (!(await isAdmin())) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  try {
    const form = await readLimitedForm(req, 60000);
    const section = String(form.get("section")) as ContentSection;
    if (!contentSections.includes(section)) return NextResponse.json({ error: "Unknown CMS section." }, { status: 400 });
    const id = String(form.get("id") ?? "");
    const expected = String(form.get("updated_at") ?? "");
    const action = form.get("action");
    if (action === "delete") await deleteContent(section, id, expected);
    else if (action === "save") {
      const input: Record<string, unknown> = Object.fromEntries(form.entries());
      input.book_slugs = form.getAll("book_slugs");
      input.payload = form.has("payload") ? JSON.parse(String(form.get("payload") || "{}")) : Object.fromEntries(
        ["subtitle", "attribution", "collection_slug", "author_id", "video_url"].filter(key => form.get(key)).map(key => [key, form.get(key)])
      );
      await saveContent(section, id, expected || null, input);
    } else return NextResponse.json({ error: "Unknown content action." }, { status: 400 });
    revalidatePath("/");
    revalidatePath("/admin/platform");
    return NextResponse.redirect(new URL(`/admin/platform/${section}?saved=1`, req.url), 303);
  } catch (error) {
    if (error instanceof PublishingError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid module data JSON." }, { status: 400 });
    // Validation errors carry no database or provider details.
    if (error instanceof ContentError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("CMS update failed", error);
    return NextResponse.json({ error: "Could not save content. Reload and try again." }, { status: 503 });
  }
}
