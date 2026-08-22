"use client";
import { useState } from "react";

export default function CopyLinkButton({ orderId }: { orderId: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="btn btn-ghost text-xs py-2 px-3.5 inline-flex items-center gap-1.5"
    >
      <span>{copied ? "\u2713 Copied link to clipboard" : "\ud83d\udd17 Copy permanent receipt link"}</span>
    </button>
  );
}
