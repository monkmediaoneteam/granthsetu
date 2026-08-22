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
