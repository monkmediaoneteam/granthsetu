export default function BookCopy({ long, highlights }: { long: string | null; highlights: string[] }) {
  const paragraphs = (long || "").split(/\n\s*\n/).filter(Boolean);
  if (!paragraphs.length && !highlights.length) return null;
  return <div className="book-copy">
    {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    {highlights.length > 0 && <ul>{highlights.map((highlight, index) => <li key={index}>{highlight}</li>)}</ul>}
  </div>;
}
