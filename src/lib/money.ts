/** All money is paise (integer). Never floats. */
export const rupees = (paise: number) =>
  "₹" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export function computeTotals(prices: number[]) {
  if (!prices.length || prices.length > 20 || prices.some(p => !Number.isSafeInteger(p) || p <= 0 || p > 2147483647)) throw new Error("Invalid prices");
  const subtotal = prices.reduce((a, b) => a + b, 0);
  if (subtotal > 2147483647) throw new Error("Order total exceeds supported amount");
  // shortcut: tax held at 0 until the CA confirms the e-book GST rate (PRD §4.8).
  // When confirmed, set TAX_BPS and the number flows to checkout, order page and email.
  const tax = 0;
  return { subtotal, tax, total: subtotal + tax };
}
