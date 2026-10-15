import Link from "next/link";
import { getReader } from "@/lib/reader-auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Publish with us", robots: { index: true, follow: true } };
export default async function PublishPage() {
  const reader = await getReader();
  const start = reader ? "/author" : "/login?next=/author";
  return <div className="wrap page-shell">
    <section className="publish-banner"><div><h1>Publish your digital edition</h1>
      <p>Reach readers across India. Every submission gets editorial review, rights clearance and agreed commercial terms before it goes on sale.</p>
      <Link className="btn btn-neel" href={start}>{reader ? "Open your author workspace" : "Sign in to start"}</Link></div>
      <div className="publish-art" aria-hidden="true"><span /><span /><span /></div></section>
    <section className="section"><div className="section-head"><div><h2>How it works</h2></div></div>
      <ol className="steps"><li>Create your author profile</li><li>Upload your manuscript, cover and sample</li><li>Editorial and rights review</li><li>Release and start selling</li></ol></section>
    <section className="section panel"><h2>What we accept</h2>
      <ul className="contents-list"><li>PDF or EPUB files</li><li>Original work, or work you hold the digital rights to</li><li>A cover image at least 1600 pixels tall</li><li>An optional free sample for readers</li></ul>
      <p className="tax-note">Approval does not release a title for sale on its own; rights, terms and clean files are all required. <Link className="text-link" href="/terms">Read the terms</Link></p></section>
  </div>;
}
