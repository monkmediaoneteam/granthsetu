"use client";
import { useState } from "react";

/**
 * Long book copy behind a disclosure. Native <details> would be lazier, but the
 * fade-out on the collapsed state needs a height cap that <details> cannot do
 * without JS anyway.
 */
export default function BookCopy({
  short,
  long,
  highlights,
}: {
  short: string | null;
  long: string | null;
  highlights: string[];
}) {
  const [open, setOpen] = useState(false);
  const paras = (long || "").split("\n\n").filter(Boolean);
  const hasMore = paras.length > 0 || highlights.length > 0;

  return (
    <div className="mb-7">
      {short && <p className="mb-4 max-w-[62ch] text-ink-soft">{short}</p>}

      {open && (
        <div className="mb-5 max-w-[62ch]">
          {paras.map((p, i) => (
            <p key={i} className="mb-4 text-ink-soft">
              {p}
            </p>
          ))}

          {highlights.length > 0 && (
            <ul className="mt-5 grid gap-2 border-l-2 border-brand/30 pl-4">
              {highlights.map((h) => (
                <li key={h} className="text-[15px] text-ink-soft">
                  {h}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="eyebrow inline-flex items-center gap-1.5 text-brand hover:text-brand-deep"
        >
          {open ? "Show less" : "View more about this book"}
          <span aria-hidden className={open ? "rotate-180 transition-transform" : "transition-transform"}>
            &darr;
          </span>
        </button>
      )}
    </div>
  );
}
