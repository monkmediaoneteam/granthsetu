"use client";
import { useEffect, useState } from "react";

export default function StickyBuyBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      // Show when scrolled past 400px
      setVisible(window.scrollY > 400);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 z-40 md:hidden">
      <div className="flex items-center justify-between gap-3 rounded-2 border border-line bg-bg/95 p-3 shadow-lg backdrop-blur-md">
        <div className="min-w-0">
          <p className="eyebrow truncate text-[10px]"> Books</p>
          <p className="truncate text-xs font-medium text-ink">Digital Editions Available</p>
        </div>
        <a
          href="#books"
          className="btn btn-primary whitespace-nowrap px-4 py-2 text-xs"
        >
          View Books &darr;
        </a>
      </div>
    </div>
  );
}
