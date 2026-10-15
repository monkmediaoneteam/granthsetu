import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Platform CMS", robots: { index: false, follow: false } };
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect("/admin/login");
  return <div className="wrap py-8">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><Link className="text-xl font-medium" href="/admin/platform">Platform CMS</Link><Link href="/admin" className="text-sm underline">Store admin</Link></div>
    <nav aria-label="Platform sections" className="mb-8 flex flex-wrap gap-x-5 gap-y-3 border-y border-line py-4 text-sm">
      {["reviews", "modules", "collections", "media", "testimonials", "authors", "delivery"].map(section => <Link key={section} href={`/admin/platform/${section}`} className="capitalize underline underline-offset-4">{section}</Link>)}
    </nav>
    {children}
  </div>;
}
