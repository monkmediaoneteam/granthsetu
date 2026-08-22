/** All money is paise (integer). Never floats. */
export const rupees = (paise: number) =>
  "₹" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });

export function computeTotals(prices: number[]) {
  const subtotal = prices.reduce((a, b) => a + b, 0);
  // ponytail: tax held at 0 until the CA confirms the e-book GST rate (PRD §4.8).
  // When confirmed, set TAX_BPS and the number flows to checkout, order page and email.
  const tax = 0;
  return { subtotal, tax, total: subtotal + tax };
}
