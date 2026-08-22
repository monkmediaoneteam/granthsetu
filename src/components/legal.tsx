/**
 * Razorpay will not activate an account without these four pages live and
 * reachable. The bracketed fields must be filled with the real entity details
 * before activation is submitted.
 */

export const ENTITY = {
  name: "INVENTAYU Pvt. Ltd.",
  address: "[REGISTERED ADDRESS \u2014 required before Razorpay activation]",
  email: "[SUPPORT EMAIL]",
  phone: "[SUPPORT PHONE]",
};

export function Legal({
  title,
  updated = "22 August 2026",
  children,
}: {
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="wrap prose-legal max-w-[760px] py-18">
      <p className="eyebrow mb-5">Last updated {updated}</p>
      <h1 className="disp h3 mb-10">{title}</h1>
      {children}
      <hr className="mt-12 mb-5 border-line" />
      <address className="text-sm not-italic text-ink-soft">
        {ENTITY.name}
        <br />
        {ENTITY.address}
        <br />
        {ENTITY.email} &middot; {ENTITY.phone}
      </address>
    </div>
  );
}
