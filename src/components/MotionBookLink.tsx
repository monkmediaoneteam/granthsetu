"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

const BookLink = motion.create(Link);

export default function MotionBookLink({ href, className, children, label }: {
  href: string; className: string; children: ReactNode; label?: string;
}) {
  const reduced = useReducedMotion();
  return <BookLink href={href} className={className} aria-label={label} initial={false}
    whileHover={reduced ? undefined : { y: -6, rotate: -1 }}
    whileFocus={reduced ? undefined : { y: -6 }}
    whileTap={reduced ? undefined : { scale: .98 }}
    transition={{ type: "spring", stiffness: 280, damping: 24 }}>
    {children}
  </BookLink>;
}
