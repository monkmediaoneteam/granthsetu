"use client";
import { useState } from "react";

type PreviewData = {
  summary: string;
  highlights: string[];
};

const PREVIEWS: Record<string, PreviewData> = {
  "integrative-perspectives": {
    summary:
      "A landmark collaborative volume bringing together 41 leading scientists, academicians, and clinicians across 51 comprehensive chapters.",
    highlights: [
      "Section 1: Epistemology & Foundational Principles of Integrative Ayurveda",
      "Section 2: Phytopharmaceuticals, Quality Standardization & Analytical Profiles",
      "Section 3: Reverse Pharmacology & Clinical Research Methodologies",
      "Section 4: Global Regulatory Standards, Pharmacovigilance & Intellectual Property",
    ],
  },
  "researching-research-for-ayurveda": {
    summary:
      "A foundational treatise synthesizing five decades of research practice into an actionable framework for Ayurvedic scientific inquiry.",
    highlights: [
      "Chapter 1: Conceptual Epistemology From Classical Texts to Scientific Inquiry",
      "Chapter 2: Hypothesis Formulation & Clinical Trial Design in Traditional Medicine",
      "Chapter 3: Botanical Authentication, Extraction & Standardization Protocols",
      "Chapter 4: Evidence-Based Translation & Bridging Academia-Industry Realities",
    ],
  },
};

export default function ChapterPreview({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const data = PREVIEWS[slug];
  if (!data) return null;

  return (
    <div className="mt-6 border-t border-line pt-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left text-xs font-mono tracking-wider uppercase text-ink-mute hover:text-ink transition-colors"
        aria-expanded={open}
      >
        <span>{open ? "Hide Table of Contents" : "Preview Table of Contents & Structure"}</span>
        <span className="text-base font-sans">{open ? "\u2212" : "+"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-3 rounded-2 bg-bg-3/40 p-4 text-sm text-ink-soft">
          <p className="font-sans text-xs italic text-ink-mute">{data.summary}</p>
          <ul className="space-y-1.5 pl-4 list-disc text-xs">
            {data.highlights.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
