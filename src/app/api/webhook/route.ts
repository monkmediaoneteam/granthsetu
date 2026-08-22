import { NextResponse } from "next/server";
import { sql, logEvent } from "@/lib/db";
import { verifyWebhook } from "@/lib/razorpay";
import { fulfilOrder } from "@/lib/fulfil";
import { alertAdmin } from "@/lib/email";

export const runtime = "nodejs";

/**
 * The only place a real payment becomes `paid`. The browser redirect is never
 * trusted — a buyer can close the tab, and a hostile one can forge the callback.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!verifyWebhook(raw, signature)) {
    console.warn("[webhook] bad signature");
    await alertAdmin(
      "Webhook Signature Verification Failed",
      "A request to /api/webhook failed signature verification. This could indicate misconfigured secrets or an invalid callback.",
      { signature, bodyPreview: raw.slice(0, 300) }
    );
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: Record<string, any>;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const payment = event?.payload?.payment?.entity;
  if (!payment) return NextResponse.json({ ok: true });

  if (event.event === "payment.failed") {
    await sql`
      update orders set status = 'payment_failed'
      where razorpay_order_id = ${payment.order_id} and status = 'created'
    `;
    await logEvent(null, "payment.failed", {
      orderId: payment.order_id,
      paymentId: payment.id,
      errorDescription: payment.error_description,
    });
    return NextResponse.json({ ok: true });
  }

  if (event.event !== "payment.captured") return NextResponse.json({ ok: true });

  const fresh = await fulfilOrder(payment.order_id, payment.id);
  return NextResponse.json({ ok: true, duplicate: !fresh });
}

