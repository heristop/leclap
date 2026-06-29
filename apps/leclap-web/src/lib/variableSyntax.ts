// Web-only presentation layer for template variables. The canonical token in the descriptor (and the
// engine) is `{{ name }}`; the leclap-web UI shows and accepts the friendlier `#name`. Convert on the
// way out to the screen and back in from user input — the descriptor itself always keeps `{{ }}`.
//
// Variable names match the engine/partial token charset: word chars, dots and hyphens.
const TOKEN_RE = /\{\{\s*([\w.-]+)\s*\}\}/g;
const HASH_RE = /#([\w.-]*[\w-])/g; // a name can't end on a dot, so trailing sentence dots stay literal

// `{{ name }}` → `#name`, for displaying descriptor text in the editor UI. Always safe: only the
// canonical token shape is rewritten; everything else is left untouched.
export const displayFromTokens = (text: string): string => text.replace(TOKEN_RE, (_, name: string) => `#${name}`);

// `#name` → `{{ name }}`, for writing user input back to the descriptor. Only names that actually exist
// are converted, so a literal `#` (a hashtag, `#1`, a CSS hex) is preserved verbatim.
export const tokensFromDisplay = (text: string, known: Iterable<string>): string => {
  const names = known instanceof Set ? known : new Set(known);

  return text.replace(HASH_RE, (match, name: string) => (names.has(name) ? `{{ ${name} }}` : match));
};
