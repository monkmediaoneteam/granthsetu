"use client";
import { useId, useState } from "react";

/**
 * Long book copy behind a disclosure. The short line and the long copy say
 * different things by design — the long copy never restates the summary.
 */
export default function BookCopy({
  long,
  highlights,
}: {
  long: string | null;
  highlights: string[];
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  const paras = (long || "").split("\n\n").filter(Boolean);
  if (paras.length === 0 && highlights.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={id}
        className="group inline-flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.08em] text-brand uppercase transition-colors hover:text-brand-deep"
      >
        <span
          aria-hidden
          className={
            "inline-block h-px w-6 bg-current transition-all duration-300 " +
            (open ? "w-3" : "group-hover:w-9")
          }
        />
        {open ? "Close" : "Inside the book"}
      </button>

      <div
        id={id}
        hidden={!open}
        className="mt-6 grid gap-5 border-l border-line-2 pl-6"
      >
        {paras.map((p, i) => (
          <p key={i} className="m-0 max-w-[64ch] text-[17px] leading-relaxed text-ink-soft">
            {p}
          </p>
        ))}

        {highlights.length > 0 && (
          <ul className="mt-1 grid gap-2.5">
            {highlights.map((h) => (
              <li
                key={h}
                className="flex gap-3 font-mono text-[12px] leading-relaxed tracking-[0.01em] text-ink-mute"
              >
                <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-gold" />
                {h}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
