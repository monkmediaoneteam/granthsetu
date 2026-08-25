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

const BRAND = {
  ink: "#0A0E0C",
  soft: "#4A524F",
  mute: "#3F4743",
  line: "#E8E6DD",
  bg: "#FFFFFF",
  bg2: "#FAFAF7",
  brand: "#2F7A4D",
  gold: "#B9852E",
};

/** Table-based layout and inline styles: Gmail strips <style> blocks. */
const shell = (body: string, preheader = "") => `
<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>INVENTAYU Books</title></head>
<body style="margin:0;padding:0;background:${BRAND.bg2};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg2};padding:32px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="max-width:600px;background:${BRAND.bg};border:1px solid ${BRAND.line};border-radius:18px;overflow:hidden;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

    <tr><td style="padding:28px 32px 0;">
      <table role="presentation" width="100%"><tr>
        <td style="font-size:15px;font-weight:600;letter-spacing:-0.02em;color:${BRAND.ink};">
          INVENTAYU<span style="font-size:9px;vertical-align:super;">&reg;</span>
          <span style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:${BRAND.mute};padding-left:4px;">Books</span>
        </td>
        <td align="right" style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:${BRAND.gold};">
          &#2405; &#2310;&#2351;&#2369;&#2352;&#2381;&#2357;&#2375;&#2342; &#2405;
        </td>
      </tr></table>
      <div style="height:1px;background:${BRAND.line};margin:18px 0 0;"></div>
    </td></tr>

    <tr><td style="padding:28px 32px 32px;">${body}</td></tr>

    <tr><td style="padding:0 32px 28px;">
      <div style="height:1px;background:${BRAND.line};margin-bottom:16px;"></div>
      <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:${BRAND.mute};">
        INVENTAYU Pvt. Ltd. &middot; Registered Start-Up &middot; MSME
      </p>
      <p style="margin:0;font-size:12px;line-height:1.6;color:${BRAND.soft};">
        Questions about your order? Just reply to this email.
      </p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

const btn = (href: string, label: string) => `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
  <tr><td style="border-radius:10px;background:${BRAND.brand};">
    <a href="${href}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${label}</a>
  </td></tr>
</table>`;

/** Invoice number is derived, not stored twice: INV-YYYYMM-<order id>. */
export function invoiceNo(order: Order) {
  const d = new Date(order.paid_at || order.created_at);
  const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `INV-${ym}-${order.id.slice(0, 8).toUpperCase()}`;
}

export function orderConfirmation(order: Order, siteUrl: string) {
  const inv = invoiceNo(order);
  const rows = order.items
    .map(
      (i) => `<tr>
        <td style="padding:12px 0;border-bottom:1px solid ${BRAND.line};font-size:15px;color:${BRAND.ink};">
          ${i.title}<br>
          <span style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:${BRAND.mute};">Digital edition &middot; PDF</span>
        </td>
        <td align="right" style="padding:12px 0;border-bottom:1px solid ${BRAND.line};font-family:'Courier New',monospace;font-size:15px;color:${BRAND.ink};white-space:nowrap;">${rupees(i.price)}</td>
      </tr>`
    )
    .join("");

  const taxRow = order.tax
    ? `<tr><td style="padding:8px 0;font-size:14px;color:${BRAND.soft};">Tax</td>
       <td align="right" style="padding:8px 0;font-family:'Courier New',monospace;font-size:14px;color:${BRAND.soft};">${rupees(order.tax)}</td></tr>`
    : "";

  return send(
    order.email,
    `Your book is ready — ${inv}`,
    shell(
      `
      <p style="margin:0 0 10px;font-family:'Courier New',monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:${BRAND.mute};">Order confirmed</p>
      <h1 style="margin:0 0 14px;font-size:28px;line-height:1.15;letter-spacing:-0.03em;font-weight:600;color:${BRAND.ink};">
        Thank you${order.name ? `, ${order.name.split(" ")[0]}` : ""}.<br>Your copy is ready.
      </h1>
      <p style="margin:0 0 26px;font-size:15px;line-height:1.65;color:${BRAND.soft};">
        Payment received. Download below &mdash; the link on your order page is
        regenerated every time you open it, so this email keeps working.
      </p>

      ${btn(`${siteUrl}/order/${order.id}`, "Download your book →")}

      <p style="margin:14px 0 30px;font-size:13px;color:${BRAND.soft};">
        Or copy this link: <a href="${siteUrl}/order/${order.id}" style="color:${BRAND.brand};">${siteUrl}/order/${order.id}</a>
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="background:${BRAND.bg2};border:1px solid ${BRAND.line};border-radius:12px;padding:20px;">
        <tr><td>
          <p style="margin:0 0 14px;font-family:'Courier New',monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:${BRAND.mute};">
            Invoice ${inv}
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${rows}
            ${taxRow}
            <tr>
              <td style="padding:12px 0 0;font-size:15px;font-weight:600;color:${BRAND.ink};">Total paid</td>
              <td align="right" style="padding:12px 0 0;font-family:'Courier New',monospace;font-size:17px;font-weight:600;color:${BRAND.brand};">${rupees(order.total)}</td>
            </tr>
          </table>
          <div style="height:1px;background:${BRAND.line};margin:16px 0;"></div>
          <p style="margin:0;font-size:12px;line-height:1.7;color:${BRAND.soft};">
            Billed to ${order.name || order.email}<br>
            ${order.email}${order.phone ? ` &middot; ${order.phone}` : ""}<br>
            Order <span style="font-family:'Courier New',monospace;">${order.id}</span>
          </p>
        </td></tr>
      </table>

      <p style="margin:24px 0 0;font-size:12px;line-height:1.7;color:${BRAND.soft};">
        Your copy carries your email on each page. It is licensed for your personal
        use &mdash; please do not redistribute it.
      </p>`,
      `Your copy of ${order.items[0]?.title ?? "your book"} is ready to download.`
    )
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

