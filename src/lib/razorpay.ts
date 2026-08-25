import crypto from "node:crypto";

/**
 * Razorpay via plain fetch — order creation is one authenticated POST and
 * webhook verification is one HMAC. The SDK would not earn its dependency.
 */
const auth = () =>
  "Basic " +
  Buffer.from(
    `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
  ).toString("base64");

export async function createRazorpayOrder(amountPaise: number, receipt: string) {
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: auth() },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes: { receipt },
    }),
  });

  if (!res.ok) {
    throw new Error(`Razorpay order failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as { id: string; amount: number; currency: string };
}

/** Verifies the X-Razorpay-Signature header against the raw request body. */
export function verifyWebhook(rawBody: string, signature: string | null) {
  if (!signature) return false;

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest("hex");

  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

/**
 * Creates a hosted Razorpay Payment Link and returns its short_url.
 *
 * Chosen over a static no-code Payment Button because a static button is the
 * same URL for every buyer — nothing ties a payment back to our order row, so
 * we could take money and not know whose book to send. `reference_id` carries
 * our order id through to the webhook, which keeps tracking intact while
 * Razorpay still hosts the entire payment page.
 */
export async function createPaymentLink(opts: {
  amountPaise: number;
  orderId: string;
  name: string;
  email: string;
  phone: string;
  description: string;
  callbackUrl: string;
}) {
  const res = await fetch("https://api.razorpay.com/v1/payment_links", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: auth() },
    body: JSON.stringify({
      amount: opts.amountPaise,
      currency: "INR",
      accept_partial: false,
      reference_id: opts.orderId,
      description: opts.description,
      customer: { name: opts.name, email: opts.email, contact: opts.phone },
      notify: { sms: false, email: false }, // we send our own branded mail
      reminder_enable: false,
      callback_url: opts.callbackUrl,
      callback_method: "get",
      notes: { order_id: opts.orderId },
    }),
  });

  if (!res.ok) {
    throw new Error(`Razorpay payment link failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as { id: string; short_url: string };
}
