import crypto from "node:crypto";

/**
 * Download tokens: HMAC over orderId|slug|exp. Stateless, unforgeable, expiring.
 * The file itself is never exposed by URL — /api/download is the only door,
 * which is also what lets us count downloads server-side.
 */
const TTL_MS = 15 * 60 * 1000;

const secret = () => {
  const s = process.env.DOWNLOAD_SECRET;
  if (!s) throw new Error("DOWNLOAD_SECRET is not set");
  return s;
};

const sign = (data: string) =>
  crypto.createHmac("sha256", secret()).update(data).digest("hex");

export function mintDownloadToken(orderId: string, slug: string) {
  const exp = Date.now() + TTL_MS;
  const data = `${orderId}|${slug}|${exp}`;
  return `${Buffer.from(data).toString("base64url")}.${sign(data)}`;
}

export function verifyDownloadToken(
  token: string
): { orderId: string; slug: string } | null {
  const [b64, mac] = token.split(".");
  if (!b64 || !mac) return null;

  let data: string;
  try {
    data = Buffer.from(b64, "base64url").toString();
  } catch {
    return null;
  }

  const expected = sign(data);
  // Constant-time compare; bail if lengths differ or timingSafeEqual throws.
  if (
    mac.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
  ) {
    return null;
  }

  const [orderId, slug, exp] = data.split("|");
  if (!orderId || !slug || !exp) return null;
  if (Date.now() > Number(exp)) return null;

  return { orderId, slug };
}
