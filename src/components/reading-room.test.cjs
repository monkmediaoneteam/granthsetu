const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const root = path.resolve(__dirname, "..");
let cart = { ready: true, slugs: [], error: "", add() {}, remove() {}, drawerOpen: false, openDrawer() {}, closeDrawer() {}, lastAdded: null };
const cache = new Map();
function load(relative, overrides = {}) {
  if (!Object.keys(overrides).length && cache.has(relative)) return cache.get(relative);
  const filename = path.join(root, relative);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  const dependency = (name) => {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (name === "./WishlistProvider" || name === "@/components/WishlistProvider") return { useWishlist: () => ({ slugs: [], ready: true, has: () => false, toggle() {} }) };
    if (name === "@/components/CartProvider" || name === "./CartProvider") return { ...load("components/CartProvider.tsx"), useCart: () => cart };
    if (name.startsWith("@/") || name.startsWith(".")) {
      const base = name.startsWith("@/") ? name.slice(2) : path.relative(root, path.resolve(path.dirname(filename), name)).split(path.sep).join("/");
      for (const ext of [".tsx", ".ts"]) if (fs.existsSync(path.join(root, base + ext))) return load(base + ext, overrides);
    }
    return require(name);
  };
  new Function("require", "module", "exports", source)(dependency, module, module.exports);
  if (!Object.keys(overrides).length) cache.set(relative, module.exports);
  return module.exports;
}

const layoutSource = fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8");
assert.match(layoutSource, /@fontsource-variable\/bricolage-grotesque/);
assert.match(layoutSource, /@fontsource\/mukta/);
assert.doesNotMatch(layoutSource, /fraunces|manrope/i);
const tokens = fs.readFileSync(path.join(root, "styles/tokens.css"), "utf8");
for (const token of ["--neel: #2B2F8F", "--ink: #16182B", "--paper: #FFFFFF", "--kumkum: #C21D3A"]) assert.ok(tokens.includes(token), token);
assert.doesNotMatch(fs.readFileSync(path.join(root, "app/globals.css"), "utf8"), /Fraunces|Manrope|font-display/);
const { buildNav } = load("lib/navigation.ts");
const cats = [
  { slug: "fiction", name: "Fiction", parent_slug: null, sort: 1 }, { slug: "crime", name: "Crime", parent_slug: "fiction", sort: 1 },
  { slug: "science", name: "Science", parent_slug: null, sort: 0 },
  ...Array.from({ length: 8 }, (_, i) => ({ slug: `c${i}`, name: `Cat ${i}`, parent_slug: null, sort: 10 + i })),
];
const nav = buildNav(cats, 7);
assert.deepEqual(nav.primary.slice(0, 2).map(c => c.slug), ["science", "fiction"]);
assert.deepEqual(nav.primary[1].children.map(c => c.slug), ["crime"]);
assert.equal(nav.primary.length, 7);
assert.equal(nav.more.length, 3);
assert.ok(!nav.primary.some(c => c.slug === "crime"), "children never appear as top-level items");
const { parseCart, cartTotals } = load("components/CartProvider.tsx");
assert.deepEqual(parseCart(null), []);
assert.deepEqual(parseCart("not-json"), []);
assert.deepEqual(parseCart('{"slug":"title"}'), []);
assert.deepEqual(parseCart('["real-book","real-book",null,3,"../private","javascript:alert(1)","another-title"]'), ["real-book", "another-title"]);
assert.equal(parseCart(JSON.stringify(Array.from({ length: 25 }, (_, i) => `book-${i}`))).length, 20);
assert.equal(cartTotals([]), null);
assert.equal(cartTotals([{ price_inr: -1 }]), null);
assert.equal(cartTotals([{ price_inr: 2147483647 }, { price_inr: 1 }]), null);

const { publicBook, visibleBook } = load("components/book-data.ts");
const record = { slug: "real-book", title: "Actual title", price_inr: 150000, active: true,
  file_url: "private/never-expose.pdf", release_approved: true, scan_status: "clean", third_party: false, isbn: "9780000000000", author_slug: "actual-author" };
const book = publicBook(record);
assert.equal(book.saleable, true);
assert.equal("file_url" in book, false);
assert.equal("scan_status" in book, false);
assert.equal(book.isbn, record.isbn);
assert.equal(book.author_slug, record.author_slug);
assert.equal(publicBook({ ...record, release_approved: false }).saleable, false);
assert.equal(publicBook({ ...record, third_party: true, rights_approved: false }).saleable, false);
assert.equal(visibleBook({ ...record, price_inr: 0, release_approved: false }), true);
assert.equal(visibleBook({ ...record, third_party: true, rights_approved: false }), false);
assert.equal(publicBook({ ...record, facts: { Subject: "Research methodology", Language: "English" } }).subject, "Research methodology");
const onSale = publicBook({ ...record, sale_price_inr: 120000 });
assert.equal(onSale.price, 120000);
assert.equal(onSale.regular, 150000);
assert.equal(onSale.onSale, true);
assert.equal(publicBook({ ...record, release_date: "2999-01-01" }).comingSoon, true);
assert.equal(publicBook({ ...record, release_date: "2000-01-01" }).comingSoon, false);
assert.doesNotThrow(() => [record].map((book) => publicBook(book)));
assert.equal(publicBook(record, new Date("2026-10-15T00:00:00Z")).comingSoon, false);
const pendingBook = publicBook({ ...record, price_inr: 0, release_approved: false });
assert.equal(pendingBook.saveable, true);
assert.equal(pendingBook.saleable, false);
const PriceView = load("components/Price.tsx").default;
const saleBook = publicBook({ ...record, price_inr: 29900, sale_price_inr: 25200 });
const priceHtml = renderToStaticMarkup(React.createElement(PriceView, { book: saleBook }));
assert.match(priceHtml, /<s[^>]*>₹299<\/s>/);
assert.match(priceHtml, /₹252/);
assert.match(priceHtml, /₹47 off/);
assert.equal(renderToStaticMarkup(React.createElement(PriceView, { book: { ...saleBook, saleable: false, comingSoon: false } })), "");
assert.match(renderToStaticMarkup(React.createElement(PriceView, { book: { ...saleBook, saleable: false, comingSoon: true } })), /Coming soon/);
const CardView = load("components/BookCard.tsx", {
  "./CartProvider": { useCart: () => cart }, "motion/react": { ...require("motion/react"), useReducedMotion: () => true },
}).default;
const cardHtml = renderToStaticMarkup(React.createElement(CardView, { book: saleBook, enabled: true }));
assert.match(cardHtml, /class="product-card"/);
assert.match(cardHtml, /Add to bag/);
assert.match(cardHtml, /href="\/books\/real-book"/);
assert.doesNotMatch(cardHtml, /private\/never-expose/);
const dataCover = renderToStaticMarkup(React.createElement(CardView, { book: { ...saleBook, cover: "data:image/svg+xml;utf8,%3Csvg%3E" }, enabled: true }));
assert.match(dataCover, /src="data:image\/svg\+xml/);
assert.match(cardHtml, /Quick view/);
const QuickViewView = load("components/QuickView.tsx", { "./CartProvider": { useCart: () => cart }, "motion/react": { ...require("motion/react"), useReducedMotion: () => true } }).default;
const qv = renderToStaticMarkup(React.createElement(QuickViewView, { book: { ...saleBook, description: "x".repeat(600) }, enabled: true }));
assert.match(qv, /<dialog/);
assert.match(qv, /View full details/);
assert.match(qv, /x{397}…/, "description is truncated with an ellipsis");
assert.doesNotMatch(qv, /x{398}/);
const { pushRecent } = load("components/RecentlyViewed.tsx", { "motion/react": { ...require("motion/react"), useReducedMotion: () => true } });
assert.deepEqual(pushRecent(["a", "b", "c"], "b"), ["b", "a", "c"]);
assert.equal(pushRecent(Array.from({ length: 12 }, (_, i) => `s${i}`), "new").length, 12);
assert.equal(pushRecent(Array.from({ length: 12 }, (_, i) => `s${i}`), "new")[0], "new");

// Author names and book text are author-supplied; inline JSON-LD must never close its <script>.
const { jsonLdHtml, bookJsonLd } = load("lib/catalogue.ts", { "./access-policy": load("lib/access-policy.ts"), "./store": { siteUrl: () => "https://store.example" } });
const hostile = { name: "</script><script>alert(1)</script> & <!-- \u2028\u2029" };
assert.doesNotMatch(jsonLdHtml(hostile), /[<>&\u2028\u2029]/);
assert.deepEqual(JSON.parse(jsonLdHtml(hostile)), hostile);
assert.equal("offers" in bookJsonLd({ ...record, cover: "/assets/c.png" }, "https://store.example/books/real-book", false), false);
assert.equal(bookJsonLd({ ...record, cover: "/assets/c.png" }, "u", true).offers.price, "1500.00");
assert.equal(bookJsonLd({ ...record, cover: "/assets/c.png" }, "u", true).image, "https://store.example/assets/c.png");
const ld = bookJsonLd({ ...record, cover: "/assets/c.png", price_inr: 29900, sale_price_inr: 25200, sale_ends_at: "2026-10-20T00:00:00+05:30" }, "u", true, new Date("2026-10-15T00:00:00Z"));
assert.equal(ld.offers.price, "252.00");
assert.equal(ld.offers.priceValidUntil, "2026-10-19");
assert.equal(bookJsonLd({ ...record, price_inr: 29900, sale_price_inr: 25200, sale_ends_at: "2026-10-01T00:00:00Z" }, "u", true, new Date("2026-10-15T00:00:00Z")).offers.price, "299.00");
assert.equal(publicBook({ ...record, third_party: true, release_approved: false }).saveable, false);

const CheckoutForm = load("app/checkout/CheckoutForm.tsx").default;
const { checkoutError } = load("app/checkout/CheckoutForm.tsx");
for (const raw of ["Purchased file storage is not configured.", "Development order unavailable.",
  "Could not start checkout. Please try again with the same idempotency key.", "Payment setup could not be completed.",
  "Unexpected provider secret", "__proto__", null, {}]) {
  assert.equal(checkoutError(503, raw).message, "Online ordering is currently unavailable. Please try again later.");
}
assert.equal(checkoutError(400, "Please enter your full name.").field, "name");
assert.equal(checkoutError(400, "Enter a valid email address.").field, "email");
assert.equal(checkoutError(400, "That is not a valid mobile number.").field, "phone");
assert.match(checkoutError(429, "rate_limit").message, /wait/);
assert.match(checkoutError(409, "A selected book is not available for sale.").message, /review your selection/);
assert.doesNotMatch(checkoutError(403, "Invalid origin.").message, /origin/);
const render = (props) => renderToStaticMarkup(React.createElement(CheckoutForm, { books: [book], ...props }));
assert.match(render({ enabled: true }), /Your bag is empty/);
cart = { ...cart, slugs: [book.slug] };
const gated = render({ enabled: false });
assert.match(gated, /Online ordering is currently unavailable/);
assert.doesNotMatch(gated, /Purchases are.*paused/);
assert.match(gated, /<button[^>]+disabled=""[^>]*>.*Payment unavailable/);
assert.doesNotMatch(gated, /private\/never-expose/);
assert.match(render({ enabled: true }), /Continue to pay/);
assert.match(render({ enabled: true, books: [{ ...book, saleable: false }] }), /Payment unavailable/);
cart = { ...cart, slugs: [] };
assert.match(render({ enabled: true, initialSlug: book.slug }), /Continue to pay/);
assert.match(render({ enabled: true, initialSlug: "missing-title" }), /Payment unavailable/);
assert.match(render({ enabled: true, initialSlug: book.slug, books: [pendingBook] }), /href="\/books\/real-book">View book details/);

let loginState = "sent";
const Login = load("app/login/LoginForm.tsx", { react: { ...React, useState: () => [loginState, value => { loginState = value; }] } }).default;
const login = Login({ next: "/library" });
assert.equal(login.props.children[1].props.disabled, true);
login.props.children[0].props.children[1].props.onChange();
assert.equal(Login({ next: "/library" }).props.children[1].props.disabled, false);

async function checkPausedSelection() {
  const AddToCart = load("components/AddToCart.tsx", {
    "./CartProvider": { useCart: () => cart },
    "motion/react": { ...require("motion/react"), useReducedMotion: () => true },
  }).default;
  cart = { ...cart, slugs: [], add: (slug) => { cart.slugs = parseCart(JSON.stringify([...cart.slugs, slug])); } };
  const props = { slug: pendingBook.slug, title: pendingBook.title, enabled: false, saleable: pendingBook.saleable, saveable: pendingBook.saveable };
  const button = AddToCart(props).props.children[0];
  assert.equal(button.props.disabled, false);
  assert.equal(button.props["aria-label"], `Save to bag: ${pendingBook.title}`);
  button.props.onClick();
  assert.deepEqual(cart.slugs, [pendingBook.slug]);
  assert.match(renderToStaticMarkup(React.createElement(AddToCart, props)), /In your bag/);
  const CartContents = load("app/cart/CartContents.tsx").default;
  const selected = renderToStaticMarkup(React.createElement(CartContents, { books: [pendingBook], enabled: false }));
  assert.match(selected, /Actual title/);
  assert.match(selected, /Saved for later/);
  assert.match(selected, /Online ordering is currently unavailable/);
  assert.match(selected, /Not yet on sale/);
  const unapprovedPrice = renderToStaticMarkup(React.createElement(CartContents, { books: [{ ...pendingBook, price_inr: 100 }], enabled: false }));
  assert.doesNotMatch(unapprovedPrice, /₹/);
  assert.match(selected, /<button[^>]+disabled=""[^>]*>Checkout unavailable/);
  assert.doesNotMatch(selected, /₹0|Remove unavailable titles|no longer available/);
  assert.match(render({ enabled: false, books: [pendingBook] }), /Payment unavailable/);
  assert.match(render({ enabled: false, books: [pendingBook] }), /Not yet on sale/);
  assert.doesNotMatch(render({ enabled: false, books: [{ ...pendingBook, price_inr: 100 }] }), /₹/);
  const priced = publicBook({ ...record, price_inr: 29900, sale_price_inr: 25200 });
  const bag = renderToStaticMarkup(React.createElement(CartContents, { books: [priced], enabled: true }));
  assert.match(bag, /₹252/);
  assert.match(bag, /<s[^>]*>₹299<\/s>/);
  assert.match(renderToStaticMarkup(React.createElement(CheckoutForm, { books: [priced], enabled: true, initialSlug: priced.slug })), /₹252/);
  cart.slugs = [];
  assert.equal(AddToCart({ ...props, enabled: true }).props.children[0].props.disabled, true);
  assert.equal(AddToCart({ ...props, enabled: true }).props.children[0].props["aria-label"], `Unavailable: ${pendingBook.title}`);
  assert.equal(AddToCart({ ...props, saveable: false }).props.children[0].props.disabled, true);
  const CartPage = load("app/cart/page.tsx", { "@/lib/db": { getBooks: async () => [
    { ...record, price_inr: 0, release_approved: false },
    { ...record, slug: "unapproved-third-party", third_party: true, release_approved: false },
  ] }, "@/components/book-data": load("components/book-data.ts"),
    "./CartContents": { default: ({ books }) => React.createElement("div", {}, books.map((book) => book.slug).join(",")) } }).default;
  const page = renderToStaticMarkup(await CartPage());
  assert.match(page, /real-book/);
  assert.doesNotMatch(page, /unapproved-third-party/);
}

async function checkRetries() {
  const originals = { fetch: global.fetch, window: global.window, sessionStorage: global.sessionStorage };
  const store = new Map();
  const requests = [];
  const redirects = [];
  let customer = { name: "Test Reader", email: "reader@example.com", phone: "9876543210" };
  let refIndex = 0;
  const refs = [];
  const Form = load("app/checkout/CheckoutForm.tsx", {
    react: { ...React, useState: (value) => [value && typeof value === "object" && "name" in value ? customer : value, () => {}],
      useRef: (value) => refs[refIndex++] ||= { current: value } },
  }).default;
  global.sessionStorage = { getItem: (key) => store.get(key) || null, setItem: (key, value) => store.set(key, value) };
  global.window = { location: { assign: (value) => redirects.push(value) } };
  global.fetch = async (_url, options) => {
    requests.push(options);
    if (requests.length === 1) throw new Error("Simulated ambiguous network failure");
    return { ok: true, status: 202, json: async () => ({ pending: true }) };
  };
  cart = { ...cart, slugs: [book.slug] };
  const submit = async (props = {}) => {
    refIndex = 0;
    const tree = Form({ books: [book], enabled: true, ...props });
    const form = tree.props.children.props.children[0];
    await form.props.onSubmit({ preventDefault() {} });
  };
  try {
    await submit(); await submit();
    const first = JSON.parse(requests[0].body), second = JSON.parse(requests[1].body);
    assert.equal(first.idempotencyKey, second.idempotencyKey);
    assert.equal(requests[0].headers["idempotency-key"], first.idempotencyKey);
    assert.deepEqual(first.slugs, [book.slug]);
    assert.equal("slug" in first, false);
    assert.equal(redirects.length, 0, "pending checkout must not redirect");
    assert.ok(![...store.values()].join().includes(customer.email), "storage must not contain customer details");
    customer = { ...customer, phone: "9876543211" };
    await submit();
    assert.notEqual(JSON.parse(requests[2].body).idempotencyKey, first.idempotencyKey);
    await submit({ initialSlug: book.slug });
    const legacy = JSON.parse(requests[3].body);
    assert.equal(legacy.slug, book.slug);
    assert.equal("slugs" in legacy, false);
    await submit({ enabled: false });
    assert.equal(requests.length, 4, "paused payments must never send a request");
    await submit({ enabled: false, books: [pendingBook] });
    await submit({ enabled: true, books: [pendingBook] });
    assert.equal(requests.length, 4, "saving a pending edition must never make it purchasable");
  } finally { Object.assign(global, originals); }
}

async function checkCatalogue() {
  const listing = load("lib/listing.ts");
  const Search = load("app/search/page.tsx", {
    "@/lib/store-data": { getStoreBooks: async () => [publicBook({ ...record, file_format: "PDF", language: "English" }), publicBook({ ...record, slug: "second-book", title: "Second title", isbn: "9781111111111", file_format: "EPUB" })],
      getCategories: async () => [], bestsellerSlugs: async () => [] },
    "@/lib/listing": listing,
    "@/components/Listing": load("components/Listing.tsx", { "./BookCard": { default: ({ book }) => React.createElement("article", { "data-book": book.slug }, book.title) }, "@/lib/listing": listing }),
  }).default;
  const render = async (query) => renderToStaticMarkup(await Search({ searchParams: Promise.resolve(query) }));
  const isbn = await render({ q: record.isbn });
  assert.match(isbn, /data-book="real-book"/);
  assert.doesNotMatch(isbn, /data-book="second-book"/);
  assert.match(await render({ format: "EPUB" }), /Remove filter EPUB/);
  assert.match(await render({ q: record.isbn, format: "EPUB" }), /No books match these filters/);
}

async function checkHomepage() {
  const content = load("lib/content.ts", { "./db": { sql() { throw new Error("Database access forbidden in UI tests"); } } });
  const helpers = load("components/content-data.ts", { "@/lib/content": content });
  assert.equal(helpers.contentUrl("javascript:alert(1)"), null);
  assert.equal(helpers.videoUrl("https://assets.example.com/interview.mp4"), "https://assets.example.com/interview.mp4");
  for (const value of ["http://assets.example.com/interview.mp4", "https://127.0.0.1/interview.mp4", "https://localhost/interview.mp4", "https://files.internal/interview.mp4", "https://assets.example.com/page", "/assets/video.mp4"]) assert.equal(helpers.videoUrl(value), null);
  const BannerView = load("components/home/BannerCarousel.tsx", { "motion/react": { useReducedMotion: () => true } }).default;
  assert.equal(renderToStaticMarkup(React.createElement(BannerView, { banners: [] })), "");
  const one = renderToStaticMarkup(React.createElement(BannerView, { banners: [{ id: "b", title: "Only offer", body: null, subtitle: null, image: null, mobileImage: null, href: "/search", label: null, theme: "coral" }] }));
  assert.match(one, /Only offer/);
  assert.doesNotMatch(one, /Pause offers|Next offer/, "a single banner has no controls");
  const two = renderToStaticMarkup(React.createElement(BannerView, { banners: ["a", "b"].map(id => ({ id, title: id, body: null, subtitle: null, image: null, mobileImage: null, href: null, label: null, theme: "sky" })) }));
  assert.match(two, /Next offer/);
  assert.doesNotMatch(two, /Pause offers/, "reduced motion never autoplays, so no pause control");
  const sitemap = load("app/sitemap.ts", { "@/lib/db": { getBooks: async () => [record, { ...record, slug: "unapproved", third_party: true, release_approved: false }] },
    "@/components/book-data": load("components/book-data.ts"), "@/lib/store-data": { getCategories: async () => [{ slug: "science" }] } }).default;
  const urls = (await sitemap()).map(item => item.url).join("\n");
  assert.match(urls, /books\/real-book/);
  assert.doesNotMatch(urls, /books\/unapproved/);
  assert.match(urls, /category\/science/);
  const Header = load("components/StoreHeader.tsx", { "next/navigation": { usePathname: () => "/", useRouter: () => ({ push() {} }) } }).default;
  const header = renderToStaticMarkup(React.createElement(Header, { name: "Reading Room by INVENTAYU", nav,
    announcement: { title: "Festive reads: up to 20% off", link_url: "/search?offer=1" } }));
  assert.match(header, /Festive reads: up to 20% off/);
  assert.match(header, /href="\/category\/fiction"/);
  assert.match(header, /href="\/category\/crime"/);
  assert.match(header, /<form[^>]+action="\/search"/);
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(Header, { name: "x", nav, announcement: null })), /announcement-bar/);
  const Shell = load("components/AdminShell.tsx").default;
  const shell = renderToStaticMarkup(React.createElement(Shell, { active: "orders", title: "Orders" }, "body"));
  for (const href of ["/admin/orders", "/admin/categories", "/admin/platform/collections", "/admin/platform/modules?type=banner", "/admin/platform/delivery"])
    assert.ok(shell.includes(`href="${href.replace("&", "&amp;")}"`), href);
  assert.match(shell, /aria-current="page"[^>]*>[^<]*Orders/);
}

Promise.resolve().then(checkPausedSelection).then(checkRetries).then(checkCatalogue).then(checkHomepage).then(() => console.log("Reading room checks passed: paused selection, cart, checkout, catalogue, video validation, banners, header, admin shell."))
  .catch((error) => { console.error(error); process.exitCode = 1; });
