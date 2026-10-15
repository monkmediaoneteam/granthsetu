import Link from "next/link";
import { getReader } from "@/lib/reader-auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Publish", robots: { index: true, follow: true } };
export default async function PublishPage() {
  const reader = await getReader();
  return <section className="wrap py-12"><div className="max-w-2xl">
    <h1 className="text-3xl font-medium">Submit a book</h1>
    <p className="mt-5 leading-relaxed text-ink-soft">Register with a verified email, prepare your book metadata, and submit a manuscript and cover for editorial review.</p>
    <p className="mt-4 leading-relaxed text-ink-soft">Publication requires editorial approval, rights clearance, agreed commercial terms, and clean reviewed files. Approval does not automatically release a title for sale.</p>
    <Link className="btn btn-primary mt-7" href={reader ? "/author" : "/login?next=/author"}>{reader ? "Author workspace" : "Sign in to submit"}</Link>
  </div></section>;
}
