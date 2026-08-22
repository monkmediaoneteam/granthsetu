"use client";
import { useState } from "react";

declare global {
  interface Window {
    Razorpay: new (opts: Record<string, unknown>) => { open: () => void };
  }
}

const loadCheckout = () =>
  new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () =>
      reject(new Error("Could not reach Razorpay. Check your connection."));
    document.body.appendChild(s);
  });

export default function CheckoutForm({
  slug,
  amountLabel,
  title,
}: {
  slug: string;
  amountLabel: string;
  title: string;
}) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, email, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start the payment.");

      // Local prototype mode: no Razorpay keys, order already fulfilled.
      if (data.noPayment) {
        window.location.href = `/order/${data.orderId}`;
        return;
      }

      await loadCheckout();

      const rzp = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        order_id: data.razorpayOrderId,
        amount: data.amount,
        currency: "INR",
        name: "INVENTAYU",
        description: title,
        prefill: { email, contact: phone },
        theme: { color: "#2F7A4D" },
        // The webhook is what actually marks the order paid. This only moves
        // the buyer to their receipt page.
        handler: () => {
          window.location.href = `/order/${data.orderId}`;
        },
        modal: { ondismiss: () => setBusy(false) },
      });

      rzp.open();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={pay} noValidate={false}>
      <div className="mb-5">
        <label className="field-label" htmlFor="email">
          Email &mdash; where your book is sent
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="field-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          aria-describedby={err ? "checkout-error" : undefined}
        />
      </div>

      <div className="mb-5">
        <label className="field-label" htmlFor="phone">
          Phone (optional)
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          className="field-input"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+91"
          autoComplete="tel"
        />
      </div>

      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? "Opening payment\u2026" : `Pay ${amountLabel}`}{" "}
        <span aria-hidden>&rarr;</span>
      </button>

      {err && (
        <p id="checkout-error" role="alert" className="mt-4 text-sm text-danger">
          {err}
        </p>
      )}
    </form>
  );
}
