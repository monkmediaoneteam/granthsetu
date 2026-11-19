// The homepage banner slots. Each one shows only the admin's image (no text is drawn on top), optionally linked.
// Shared by the homepage, Admin > Banners and the server checks. Client-safe.
export const BANNER_SLOTS = {
  hero: {
    label: "Hero carousel", where: "Top of the homepage. Several live banners rotate in the order shown.",
    size: "1600 × 700 px", ratio: "16 / 7", mobileSize: "800 × 1000 px", mobileRatio: "4 / 5", many: true, preset: "hero",
  },
  "side-1": {
    label: "Side card 1", where: "Beside the hero, top. Only the first live banner shows.",
    size: "900 × 600 px", ratio: "3 / 2", mobileSize: "800 × 600 px", mobileRatio: "4 / 3", many: false, preset: "side",
  },
  "side-2": {
    label: "Side card 2", where: "Beside the hero, bottom. Only the first live banner shows.",
    size: "900 × 600 px", ratio: "3 / 2", mobileSize: "800 × 600 px", mobileRatio: "4 / 3", many: false, preset: "side",
  },
  band: {
    label: "Wide band", where: "Lower on the homepage, above the questions. Only the first live banner shows; hidden when empty.",
    size: "1600 × 400 px", ratio: "4 / 1", mobileSize: "800 × 600 px", mobileRatio: "4 / 3", many: false, preset: undefined,
  },
  product: {
    label: "Book pages", where: "On every book page, below the book details. Only the first live banner shows; hidden when empty.",
    size: "1600 × 400 px", ratio: "4 / 1", mobileSize: "800 × 600 px", mobileRatio: "4 / 3", many: false, preset: undefined,
  },
  listing: {
    label: "Search and category pages", where: "Above the results on search and category pages. Only the first live banner shows; hidden when empty.",
    size: "1600 × 400 px", ratio: "4 / 1", mobileSize: "800 × 600 px", mobileRatio: "4 / 3", many: false, preset: undefined,
  },
} as const;

export type BannerSlot = keyof typeof BANNER_SLOTS;
export const SLOT_KEYS = Object.keys(BANNER_SLOTS) as BannerSlot[];
export const toSlot = (value: unknown): BannerSlot => (typeof value === "string" && value in BANNER_SLOTS ? value as BannerSlot : "hero");

// Stored instants are shown and entered in India time.
export function toIndiaInput(value: string | null) {
  if (!value) return "";
  const t = Date.parse(value.includes("T") ? value : value.replace(" ", "T"));
  if (!Number.isFinite(t)) return "";
  return new Date(t + 330 * 60000).toISOString().slice(0, 16);
}
