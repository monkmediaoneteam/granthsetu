# INVENTAYU Books

Digital storefront for Dr. Narendra Bhatt's books. **Standalone project** its
own repo, own Vercel project, own Neon database. Shares nothing with the main
inventayu.com site except the design tokens, which are copied, not imported.

See `PRD.md` for scope and decisions.

## Stack

Next.js 16 (App Router, Turbopack) - React 19 - Tailwind v4 - Neon Postgres -
Razorpay - Resend. Design tokens live in `src/app/globals.css` under `@theme`,
copied from inventayu.com so both properties read as one system.

## Setup

```bash
npm install
cp .env.example .env.local     # fill in the values
npm run seed                   # applies schema.sql + placeholder catalogue
npm run dev
```

## Environment

| Var | Where from |
|---|---|
| `DATABASE_URL` | Neon → new project → connection string |
| `RAZORPAY_KEY_ID` / `_SECRET` | Razorpay dashboard → API keys |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | same key id, exposed to the browser |
| `RAZORPAY_WEBHOOK_SECRET` | set when creating the webhook |
| `RESEND_API_KEY` | Resend dashboard |
| `DOWNLOAD_SECRET` | `openssl rand -hex 32` |
| `ADMIN_TOKEN` | any long random string |

## Razorpay webhook

Point it at `https://<domain>/api/webhook` and use the same secret as
`RAZORPAY_WEBHOOK_SECRET`. Subscribe to all five events:

| Event | What it does |
|---|---|
| `payment_link.paid` | marks the order paid, sends the book — **the important one** |
| `payment_link.cancelled` | marks the order failed |
| `payment_link.expired` | marks the order failed |
| `payment.captured` | same as above, for the older Orders API path |
| `payment.failed` | marks the order failed |

Checkout creates hosted **Payment Links** (`plink_…`) rather than Orders, with
`reference_id` set to our order id — a static no-code Payment Button would be
the same URL for every buyer, so nothing would tie a payment back to an order.

The webhook is the only thing that marks an order paid. The browser redirect
just moves the buyer to their receipt — never trust it for money. If a webhook
is ever missed, the hourly `/api/cron/reconcile` job asks Razorpay directly and
recovers the order.

## Committing

Do **not** override the git identity when committing. Vercel blocks a
deployment when GitHub cannot associate the committer with a GitHub user, and
on a Hobby plan an unrecognised committer counts as a second team member:

> The Deployment was blocked because GitHub could not associate the committer
> with a GitHub user.

Plain `git commit` uses this repo's configured identity, which is correct.

## Going live

1. Swap the Razorpay test keys for live keys (3 env vars).
2. Repoint the webhook at the production URL.
3. Nothing else. No code change.

## Still placeholder

- Book prices, covers, ISBN, page counts, year see `scripts/seed.mjs`.
- `books.file_url` is empty; downloads return 503 until the real PDFs are hosted.
- Entity address, support email and phone in `src/app/legal.tsx`.
- Tax is hardcoded to 0 pending the e-book GST answer (`src/lib/money.ts`).
