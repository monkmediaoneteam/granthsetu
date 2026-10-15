export default function ChapterPreview({ contents = [] }: { slug?: string; contents?: string[] }) {
  if (!contents.length) return null;
  return <details className="mt-6 border-t border-line pt-4">
    <summary className="cursor-pointer text-sm font-medium">Table of contents</summary>
    <ul className="mt-4 list-disc pl-5 text-sm text-ink-soft">{contents.map((chapter, index) => <li key={index} className="mb-2">{chapter}</li>)}</ul>
  </details>;
}
