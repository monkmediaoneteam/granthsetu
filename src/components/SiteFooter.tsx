import Link from "next/link";

export default function SiteFooter({ name, categories }: { name: string; categories: { slug: string; name: string }[] }) {
  const cols: [string, [string, string][]][] = [
    ["Shop", [["All books", "/search"], ["New arrivals", "/search?sort=new"], ["Offers", "/search?offer=1"], ["Wishlist", "/wishlist"]]],
    ["Your account", [["Library", "/library"], ["Bag", "/cart"], ["Sign in", "/login"]]],
    ["Help", [["Delivery and downloads", "/delivery-policy"], ["Refunds", "/refund-policy"], ["Privacy", "/privacy"], ["Terms", "/terms"]]],
    ["Authors", [["Publish with us", "/publish"], ["Author workspace", "/author"]]],
  ];
  return <footer className="site-footer"><div className="wrap">
    <div className="footer-cols">
      <div><Link href="/" className="logo"><span className="logo-mark" aria-hidden="true">अ</span><span>{name}</span></Link>
        <p className="footer-about">Digital books from independent authors and publishers across India. Instant download, yours to keep.</p></div>
      {cols.map(([title, links]) => <div key={title}><h2>{title}</h2><ul>{links.map(([label, href]) => <li key={href}><Link href={href}>{label}</Link></li>)}</ul></div>)}
    </div>
    {categories.length > 0 && <div className="popular"><h2>Popular searches</h2><ul>{categories.slice(0, 16).map((c) =>
      <li key={c.slug}><Link className="chip" href={`/category/${c.slug}`}>{c.name}</Link></li>)}</ul></div>}
    <p className="footer-legal">© {new Date().getFullYear()} {name}. Digital editions only; nothing is shipped.</p>
  </div><div className="wrap footer-word" aria-hidden="true">Reading Room</div></footer>;
}
