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
    s.onerror = () => reject(new Error("Could not reach Razorpay. Check your connection."));
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
      await loadCheckout();

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, email, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start the payment.");

      const rzp = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        order_id: data.razorpayOrderId,
        amount: data.amount,
        currency: "INR",
        name: "INVENTAYU®",
        description: title,
        prefill: { email, contact: phone },
        theme: { color: "#2F7A4D" },
        // The webhook is what actually marks the order paid. This only moves
        // the buyer to their receipt page.
        handler: () => {
          window.location.href = `/order/${data.orderId}`;
        },
        modal: {
          ondismiss: () => setBusy(false),
        },
      });

      rzp.open();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={pay}>
      <label className="field">
        <span>Email — where your book is sent</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
        />
      </label>

      <label className="field">
        <span>Phone (optional)</span>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+91"
          autoComplete="tel"
        />
      </label>

      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? "Opening payment…" : `Pay ${amountLabel}`} <span aria-hidden>→</span>
      </button>

      {err && (
        <p role="alert" style={{ color: "#B3261E", fontSize: 14, marginTop: 16 }}>
          {err}
        </p>
      )}
    </form>
  );
}
