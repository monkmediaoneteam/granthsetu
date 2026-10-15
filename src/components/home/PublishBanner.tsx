import Link from "next/link";

export default function PublishBanner() {
  return <section className="wrap section"><div className="publish-band">
    <span className="publish-glyph akshara" aria-hidden="true">अ</span>
    <div className="publish-copy"><h2>Your book deserves readers.</h2>
      <p>Publish your digital edition with us. Every submission gets editorial review, rights clearance and agreed terms before it goes on sale.</p>
      <Link className="btn band-btn" href="/publish">Start publishing</Link></div>
  </div></section>;
}
