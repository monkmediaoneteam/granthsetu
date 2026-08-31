/**
 * Every piece of storefront identity lives here. The store carries books from
 * multiple authors and publishers, so nothing in the UI should belong to any
 * one of them — a book's own publisher and contributors are part of the book
 * record, not the shop.
 *
 * Rename the store by setting NEXT_PUBLIC_STORE_NAME, or by editing below.
 */

export const STORE = {
  /** Shown in the navbar, page titles and emails. */
  name: process.env.NEXT_PUBLIC_STORE_NAME || "The Reading Room",

  /** One line under the store name in the hero eyebrow. */
  kicker: "Digital editions",

  tagline:
    "Research titles on Ayurveda, natural products and allied sciences — sold as PDFs and delivered the moment you pay.",

  /**
   * The legal seller. This is NOT decorative: Razorpay requires the entity that
   * receives the money to be named on the policy pages, and the same entity has
   * to appear on invoices. It must match the Razorpay account holder even when
   * the storefront itself is unbranded.
   */
  legalEntity: process.env.LEGAL_ENTITY_NAME || "[REGISTERED SELLER NAME]",
  legalAddress: process.env.LEGAL_ENTITY_ADDRESS || "[REGISTERED ADDRESS]",
  supportEmail: process.env.SUPPORT_EMAIL || "[SUPPORT EMAIL]",
  supportPhone: process.env.SUPPORT_PHONE || "[SUPPORT PHONE]",
} as const;

export const siteUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
