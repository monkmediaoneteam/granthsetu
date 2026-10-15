const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const root = path.resolve(__dirname, "..");
let cart = { ready: true, slugs: [], error: "", add() {}, remove() {} };
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
    if (name === "@/components/CartProvider") return { ...load("components/CartProvider.tsx"), useCart: () => cart };
    if (name === "@/lib/catalogue") return { isSaleable: load("lib/access-policy.ts").saleable };
    if (name === "@/lib/money") return load("lib/money.ts");
    if (name === "@/lib/store") return load("lib/store.ts");
    if (name === "./MotionBookLink") return load("components/MotionBookLink.tsx");
    return require(name);
  };
  new Function("require", "module", "exports", source)(dependency, module, module.exports);
  if (!Object.keys(overrides).length) cache.set(relative, module.exports);
  return module.exports;
}

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
const pendingBook = publicBook({ ...record, price_inr: 0, release_approved: false });
assert.equal(pendingBook.saveable, true);
assert.equal(pendingBook.saleable, false);

// Author names and book text are author-supplied; inline JSON-LD must never close its <script>.
const { jsonLdHtml, bookJsonLd } = load("lib/catalogue.ts", { "./access-policy": load("lib/access-policy.ts"), "./store": { siteUrl: () => "https://store.example" } });
const hostile = { name: "</script><script>alert(1)</script> & <!-- \u2028\u2029" };
assert.doesNotMatch(jsonLdHtml(hostile), /[<>&\u2028\u2029]/);
assert.deepEqual(JSON.parse(jsonLdHtml(hostile)), hostile);
assert.equal("offers" in bookJsonLd({ ...record, cover: "/assets/c.png" }, "https://store.example/books/real-book", false), false);
assert.equal(bookJsonLd({ ...record, cover: "/assets/c.png" }, "u", true).offers.price, "1500.00");
assert.equal(bookJsonLd({ ...record, cover: "/assets/c.png" }, "u", true).image, "https://store.example/assets/c.png");
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
assert.match(render({ enabled: true }), /Your cart is empty/);
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
  assert.equal(button.props["aria-label"], `Save to cart: ${pendingBook.title}`);
  button.props.onClick();
  assert.deepEqual(cart.slugs, [pendingBook.slug]);
  assert.match(renderToStaticMarkup(React.createElement(AddToCart, props)), /In your cart/);
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
  const Catalogue = load("app/catalogue/page.tsx", {
    "@/lib/db": { getBooks: async () => [
      { ...record, file_format: "PDF", facts: { Subject: "Research methodology", Language: "English" } },
      { ...record, slug: "second-book", title: "Second title", isbn: "9781111111111", file_format: "EPUB" },
    ] },
    "@/lib/content": { getPublicContent: async () => ({ modules: [], collections: [], authors: [] }) },
    "@/components/book-data": load("components/book-data.ts"),
    "@/components/BookCard": { default: ({ book }) => React.createElement("article", { "data-book": book.slug }, book.title) },
  }).default;
  const renderQuery = async (query) => renderToStaticMarkup(await Catalogue({ searchParams: Promise.resolve(query) }));
  const isbn = await renderQuery({ q: record.isbn });
  assert.match(isbn, /data-book="real-book"/);
  assert.doesNotMatch(isbn, /data-book="second-book"/);
  const format = await renderQuery({ format: "EPUB" });
  assert.match(format, /data-book="second-book"/);
  assert.doesNotMatch(format, /data-book="real-book"/);
  const facts = await renderQuery({ subject: "Research methodology", language: "English" });
  assert.match(facts, /data-book="real-book"/);
  assert.match(await renderQuery({ q: record.isbn, format: "EPUB" }), /No books found/);
  // Facets count against the other filters, stay plain links, and active ones become removable chips.
  assert.match(format, /href="\/catalogue\?format=PDF"/);
  assert.match(format, /aria-label="Remove filter EPUB" href="\/catalogue"|href="\/catalogue" aria-label="Remove filter EPUB"/);
  assert.doesNotMatch(await renderQuery({ subject: "Research methodology" }), /Second title/);
}

async function checkHomepage() {
  const { default: DiscoveryFeatures, SubjectNavigation } = load("components/DiscoveryFeatures.tsx");
  const discoveryBooks = [
    { ...record, title: "AYURVEDA", subtitle: null, description: null, subject: null },
    { ...record, slug: "reference", title: "A volume", subtitle: "REFERENCE", description: null, subject: null },
    { ...record, slug: "research", title: "Studies", subtitle: null, description: "RESEARCH methods", subject: null },
    { ...record, slug: "natural", title: "Products", subtitle: null, description: null, subject: "NATURAL PRODUCTS" },
    { ...record, slug: "hidden", title: "Phytopharmaceuticals", active: false },
    { ...record, slug: "unreleased", title: "Phytopharmaceuticals", third_party: true, release_approved: false },
  ].filter(visibleBook).map(publicBook);
  const interests = renderToStaticMarkup(React.createElement(SubjectNavigation, { books: discoveryBooks }));
  for (const query of ["Ayurveda", "reference", "research", "natural%20products"]) assert.ok(interests.includes(`href="/catalogue?q=${query}"`));
  assert.doesNotMatch(interests, /Phytopharmaceuticals/);
  assert.match(interests, /All books/);
  assert.equal(renderToStaticMarkup(React.createElement(SubjectNavigation, { books: [] })), "");
  const unmatched = renderToStaticMarkup(React.createElement(SubjectNavigation, { books: [{ ...book, title: "Poetry", subtitle: null, description: null, subject: null }] }));
  assert.equal((unmatched.match(/<a /g) || []).length, 1);
  assert.match(unmatched, /All books/);
  assert.equal(renderToStaticMarkup(React.createElement(DiscoveryFeatures, { books: [book] })), "");
  const features = renderToStaticMarkup(React.createElement(DiscoveryFeatures, { books: [
    { ...book, slug: "no-description", cover: "/assets/book1.png" },
    { ...book, slug: "first", description: "About this book" },
    { ...book, slug: "second", highlights: ["Supplied chapter highlight"] },
    { ...book, slug: "third", description: "About this book" },
  ] }));
  assert.match(features, /href="\/books\/first"/);
  assert.match(features, /href="\/books\/second"/);
  assert.match(features, /Supplied chapter highlight/);
  assert.doesNotMatch(features, /href="\/books\/(?:no-description|third)"|<img/);
  const content = load("lib/content.ts", { "./db": { sql() { throw new Error("Database access forbidden in UI tests"); } } });
  const helpers = load("components/content-data.ts", { "@/lib/content": content });
  const moduleRecord = (value) => ({ id: "module", type: "text", title: "Editorial", body: "Supplied copy", image_url: null,
    mobile_image_url: null, link_url: null, link_label: null, payload: {}, sort: 0, status: "published", publish_at: null, ...value });
  const Hero = load("components/Hero.tsx", { "./content-data": helpers,
    "@/lib/store": { STORE: { name: "Reading Room by INVENTAYU", kicker: "Digital editions", tagline: "Reference editions" } } }).default;
  const cardOf = (book) => React.createElement("article", { "data-book": book.slug, key: book.slug }, book.title);
  const Card = { default: ({ book }) => cardOf(book), Shelf: ({ books }) => books.map(cardOf) };
  const Sections = load("components/ContentSections.tsx", { "./content-data": helpers, "./BookCard": Card }).default;
  const publishedHero = moduleRecord({ type: "hero", title: "Published shelf", body: "Published introduction", image_url: "/assets/DrNarendraBhatt.jpg", link_url: "/catalogue", link_label: "Browse editions" });
  const hero = renderToStaticMarkup(React.createElement(Hero, { books: [{ ...book, cover: "/assets/book1.png" }], module: publishedHero }));
  assert.match(hero, /Published shelf/);
  assert.match(hero, /Published introduction/);
  assert.match(hero, /DrNarendraBhatt.jpg/);
  assert.match(hero, /book1.png/);
  assert.match(hero, /Browse editions/);
  assert.match(hero, /<picture class="hero-editorial-media"/);
  const externalCover = renderToStaticMarkup(React.createElement(Hero, { books: [{ ...book, cover: "https://approved.example/cover.png" }] }));
  assert.match(externalCover, /src="https:\/\/approved.example\/cover.png"/);
  const draft = renderToStaticMarkup(React.createElement(Hero, { books: [book], module: { ...publishedHero, status: "draft" } }));
  assert.doesNotMatch(draft, /Published shelf|DrNarendraBhatt.jpg/);
  assert.match(draft, /reading-room-botanical-v2.webp/);
  assert.equal(helpers.contentUrl("javascript:alert(1)"), null);
  assert.equal(helpers.videoUrl("https://assets.example.com/interview.mp4"), "https://assets.example.com/interview.mp4");
  for (const value of ["http://assets.example.com/interview.mp4", "https://127.0.0.1/interview.mp4", "https://localhost/interview.mp4", "https://files.internal/interview.mp4", "https://assets.example.com/page", "/assets/video.mp4"]) assert.equal(helpers.videoUrl(value), null);
  const modules = [moduleRecord({ id: "last", title: "Last module", sort: 3 }), moduleRecord({ id: "hero", type: "hero" }),
    moduleRecord({ id: "middle", type: "collection", title: "Middle collection", sort: 2, payload: { collection_slug: "linked" } }),
    moduleRecord({ id: "first", title: "First module", sort: 1 }), moduleRecord({ id: "draft", title: "Hidden draft", status: "draft" }),
    moduleRecord({ id: "future", title: "Hidden future", publish_at: "9999-01-01" })];
  const collections = [{ slug: "linked", title: "Linked shelf", description: "Supplied description", book_slugs: [book.slug] },
    { slug: "remaining", title: "Another shelf", description: null, book_slugs: [book.slug] },
    { slug: "empty", title: "Empty shelf", book_slugs: [] }];
  const renderSections = (extra = {}) => renderToStaticMarkup(React.createElement(Sections, { modules, collections, authors: [], books: [book], enabled: false, ...extra }));
  const ordered = renderSections();
  assert.ok(ordered.indexOf("First module") < ordered.indexOf("Middle collection"));
  assert.ok(ordered.indexOf("Middle collection") < ordered.indexOf("Last module"));
  assert.doesNotMatch(ordered, /Hidden draft|Hidden future|Empty shelf|data-book=/);
  assert.equal((ordered.match(/collection=linked/g) || []).length, 1);
  assert.equal((ordered.match(/collection=remaining/g) || []).length, 1);
  assert.match(renderSections({ books: [book, { ...book, slug: "second" }, { ...book, slug: "third" }] }), /data-book="real-book"/);
  const video = renderSections({ modules: [moduleRecord({ type: "media", link_url: "https://assets.example.com/interview.mp4" })], collections: [] });
  assert.match(video, /<video[^>]+controls=""[^>]+preload="none"/);
  assert.doesNotMatch(video, /autoPlay|<iframe/);
  const payloadVideo = renderSections({ modules: [moduleRecord({ type: "media", payload: { video_url: "https://assets.example.com/interview.webm" }, link_url: "https://example.com/article" })], collections: [] });
  assert.match(payloadVideo, /<video[^>]+src="https:\/\/assets.example.com\/interview.webm"/);
  assert.match(payloadVideo, /href="https:\/\/example.com\/article"/);
  assert.doesNotMatch(renderSections({ modules: [moduleRecord({ type: "testimonial", body: "Unattributed" })], collections: [] }), /Unattributed/);
  const Home = load("app/page.tsx", { "@/lib/db": { getBooks: async () => [record,
    { ...record, slug: "hidden", title: "Phytopharmaceuticals", active: false },
    { ...record, slug: "unreleased", title: "Phytopharmaceuticals", third_party: true, release_approved: false },
  ] },
    "@/lib/content": { getPublicContent: async () => ({
      modules: [moduleRecord({ type: "author", payload: { author_id: "narendra-bhatt" } })], collections: [],
      authors: [{ id: "narendra-bhatt", name: "Dr. Narendra Bhatt", bio: "Author biography", photo_url: "/assets/DrNarendraBhatt.jpg" }],
    }) },
    "@/components/book-data": load("components/book-data.ts"), "@/components/content-data": helpers,
    "@/components/DiscoveryFeatures": {
      default: () => React.createElement("section", { "data-discovery-features": true }),
      SubjectNavigation,
    },
    "@/components/Hero": { default: Hero }, "@/components/BookCard": Card, "@/components/ContentSections": { default: Sections } }).default;
  const home = renderToStaticMarkup(await Home());
  assert.match(home, /id="publish"/);
  assert.match(home, /rights clearance/);
  assert.match(home, /id="faq"/);
  assert.equal((home.match(/<details>/g) || []).length, 6);
  assert.match(home, /How do I choose a book\?/);
  assert.match(home, /data-discovery-features/);
  assert.doesNotMatch(home, /Phytopharmaceuticals|data-book="(?:hidden|unreleased)"/);
  assert.doesNotMatch(home, /Can I buy books right now\?|Purchases are currently paused/);
  assert.doesNotMatch(home, /author-section|Author biography|DrNarendraBhatt.jpg/);
  const sitemap = load("app/sitemap.ts", { "@/lib/db": { getBooks: async () => [record, { ...record, slug: "unapproved", third_party: true, release_approved: false }] },
    "@/components/book-data": load("components/book-data.ts") }).default;
  const urls = (await sitemap()).map(item => item.url).join("\n");
  assert.match(urls, /books\/real-book/);
  assert.doesNotMatch(urls, /books\/unapproved/);
}

Promise.resolve().then(checkPausedSelection).then(checkRetries).then(checkCatalogue).then(checkHomepage).then(() => console.log("Reading room checks passed: paused selection, cart, checkout, catalogue, hero settings, module order, collections, video validation, publishing invitation, and FAQ."))
  .catch((error) => { console.error(error); process.exitCode = 1; });
