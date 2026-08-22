# INVENTAYU Books

Digital storefront for Dr. Narendra Bhatt's books. **Standalone project** — its
own repo, own Vercel project, own Neon database. Shares nothing with the main
inventayu.com site except the design tokens, which are copied, not imported.

See `PRD.md` for scope and decisions.

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

Point it at `https://<domain>/api/webhook`, subscribe to **`payment.captured`**
and **`payment.failed`**, and use the same secret as `RAZORPAY_WEBHOOK_SECRET`.

The webhook is the only thing that marks an order paid. The browser redirect
just moves the buyer to their receipt — never trust it for money.

## Going live

1. Swap the Razorpay test keys for live keys (3 env vars).
2. Repoint the webhook at the production URL.
3. Nothing else. No code change.

## Still placeholder

- Book prices, covers, ISBN, page counts, year — see `scripts/seed.mjs`.
- `books.file_url` is empty; downloads return 503 until the real PDFs are hosted.
- Entity address, support email and phone in `src/app/legal.tsx`.
- Tax is hardcoded to 0 pending the e-book GST answer (`src/lib/money.ts`).
