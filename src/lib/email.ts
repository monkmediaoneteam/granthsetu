import { rupees } from "./money";
import type { Order } from "./db";
import { env } from "./env";

/** Resend is one POST. Failures are logged, never thrown — a dead mail
 *  provider must not roll back a captured payment. */
async function send(to: string, subject: string, html: string) {
  const key = env("RESEND_API_KEY");
  if (!key) {
    console.warn("[email] RESEND_API_KEY unset, skipping:", subject);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to, subject, html }),
    });
    if (!res.ok) console.error("[email] send failed:", await res.text());
  } catch (err) {
    console.error("[email] send threw:", err);
  }
}

const shell = (body: string) => `
<div style="font-family:ui-sans-serif,system-ui,sans-serif;color:#0A0E0C;max-width:560px;margin:0 auto;padding:32px 24px;background:#FFFFFF">
  <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#4A524F;font-family:ui-monospace,monospace">INVENTAYU&reg;</div>
  <div style="height:1px;background:#E8E6DD;margin:16px 0 28px"></div>
  ${body}
  <div style="height:1px;background:#E8E6DD;margin:32px 0 16px"></div>
  <div style="font-size:12px;color:#4A524F;line-height:1.6">
    INVENTAYU Pvt. Ltd. &middot; Registered Start-Up &middot; MSME<br/>
    Questions? Reply to this email.
  </div>
</div>`;

export function orderConfirmation(order: Order, siteUrl: string) {
  const lines = order.items
    .map(
      (i) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #E8E6DD">${i.title}</td>
         <td style="padding:8px 0;border-bottom:1px solid #E8E6DD;text-align:right;font-family:ui-monospace,monospace">${rupees(i.price)}</td></tr>`
    )
    .join("");

  return send(
    order.email,
    "Your INVENTAYU book is ready to download",
    shell(`
      <div style="font-size:28px;font-weight:500;letter-spacing:-.03em;line-height:1.15;margin-bottom:16px">Thank you. Your copy is ready.</div>
      <p style="color:#4A524F;line-height:1.6;margin:0 0 24px">Payment received. Download from your order page below — links are regenerated each time, so this email will keep working.</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px">${lines}</table>
      <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
        <tr><td style="padding:8px 0;font-weight:500">Total</td>
        <td style="padding:8px 0;text-align:right;font-family:ui-monospace,monospace;font-weight:500">${rupees(order.total)}</td></tr>
      </table>
      <a href="${siteUrl}/order/${order.id}" style="display:inline-block;background:#2F7A4D;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:500">Download your book &rarr;</a>
      <p style="color:#4A524F;font-size:13px;line-height:1.6;margin:24px 0 0">Order <span style="font-family:ui-monospace,monospace">${order.id}</span>. Keep this email — it is your permanent access link.</p>
    `)
  );
}

export function alertAdmin(subject: string, message: string, details?: unknown) {
  const adminEmail = env("ADMIN_EMAIL");
  if (!adminEmail) {
    console.warn("[email-alert] ADMIN_EMAIL unset; alert message:", subject, message);
    return;
  }

  const detailsFormatted = details
    ? `<pre style="background:#F6F5F0;padding:12px;border-radius:6px;font-size:12px;overflow:auto">${JSON.stringify(details, null, 2)}</pre>`
    : "";

  return send(
    adminEmail,
    `[INVENTAYU Alert] ${subject}`,
    shell(`
      <div style="font-size:20px;font-weight:600;color:#B3261E;margin-bottom:12px">${subject}</div>
      <p style="color:#4A524F;line-height:1.6">${message}</p>
      ${detailsFormatted}
    `)
  );
}

