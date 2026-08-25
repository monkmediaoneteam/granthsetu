"use client";
import { useState } from "react";

type Field = "name" | "email" | "phone";

export default function CheckoutForm({
  slug,
  amountLabel,
}: {
  slug: string;
  amountLabel: string;
  title?: string;
}) {
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ message: string; field?: Field } | null>(null);

  const set = (k: Field) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, ...form }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr({ message: data.error || "Could not start the payment.", field: data.field });
        setBusy(false);
        return;
      }

      // Razorpay hosts the payment page; we only redirect and wait for the webhook.
      window.location.href = data.paymentUrl || `/order/${data.orderId}`;
    } catch {
      setErr({ message: "Network problem. Please try again." });
      setBusy(false);
    }
  }

  const fields: { k: Field; label: string; type: string; ac: string; ph: string; hint?: string }[] = [
    { k: "name", label: "Full name", type: "text", ac: "name", ph: "Narendra Bhatt" },
    {
      k: "email",
      label: "Email — where your book is sent",
      type: "email",
      ac: "email",
      ph: "you@example.com",
      hint: "Use a permanent address. Disposable inboxes are rejected.",
    },
    {
      k: "phone",
      label: "Mobile number",
      type: "tel",
      ac: "tel",
      ph: "98765 43210",
      hint: "Indian mobile, 10 digits.",
    },
  ];

  return (
    <form onSubmit={pay}>
      {fields.map((f) => (
        <div className="mb-5" key={f.k}>
          <label className="field-label" htmlFor={f.k}>
            {f.label}
          </label>
          <input
            id={f.k}
            name={f.k}
            type={f.type}
            required
            className="field-input"
            value={form[f.k]}
            onChange={set(f.k)}
            placeholder={f.ph}
            autoComplete={f.ac}
            aria-invalid={err?.field === f.k || undefined}
            aria-describedby={err?.field === f.k ? "checkout-error" : `${f.k}-hint`}
          />
          {f.hint && (
            <p id={`${f.k}-hint`} className="mt-1.5 text-[13px] text-ink-soft">
              {f.hint}
            </p>
          )}
        </div>
      ))}

      <button className="btn btn-primary mt-2" type="submit" disabled={busy}>
        {busy ? "Redirecting to payment\u2026" : `Pay ${amountLabel}`}{" "}
        <span aria-hidden>&rarr;</span>
      </button>

      <p className="eyebrow mt-3">Secure payment handled by Razorpay</p>

      {err && (
        <p id="checkout-error" role="alert" className="mt-4 text-sm text-danger">
          {err.message}
        </p>
      )}
    </form>
  );
}
