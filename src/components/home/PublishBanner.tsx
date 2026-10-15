import Link from "next/link";
export default function PublishBanner() {
  return <section className="wrap section"><div className="publish-banner">
    <div><h2>Your book deserves readers</h2><p>Publish your digital edition with us. Editorial review, fair terms, and readers across India.</p>
      <Link className="btn btn-yellow" href="/publish">Start publishing</Link></div>
    <div className="publish-art" aria-hidden="true"><span /><span /><span /></div></div></section>;
}
