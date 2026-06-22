import { Fragment } from 'react';

// Escape regex metacharacters so the user's raw query is matched literally (and can't break or inject
// into the matcher).
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

interface HighlightMatchProps {
  text: string;
  query: string;
}

// Renders `text` with every case-insensitive occurrence of `query` wrapped in an animated-gradient
// <mark>. XSS-safe by construction: it builds plain React text nodes (no dangerouslySetInnerHTML), so
// any markup in `text`/`query` is rendered as literal characters, never parsed as HTML.
export const HighlightMatch = ({ text, query }: HighlightMatchProps) => {
  const needle = query.trim();

  if (needle === '') return <>{text}</>;

  const parts = text.split(new RegExp(`(${escapeRegExp(needle)})`, 'ig'));
  const lower = needle.toLowerCase();

  return (
    <>
      {parts.map((part, index) =>
        part !== '' && part.toLowerCase() === lower ? (
          <mark key={index} className="text-gradient-animated bg-transparent">
            {part}
          </mark>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        )
      )}
    </>
  );
};
