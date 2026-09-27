import { DEFAULT_FONT_WEIGHT, type FontRef } from '@/core/fonts';

// Resolution of a `FontRef` against the Google Fonts CSS API, kept as pure string functions so the
// URL building and the CSS parsing are testable without any I/O. The fetch itself lives in
// `AssetManager.stageFont`, which owns the staging ladder and the filesystem.
//
// The css2 endpoint is used rather than the legacy `css?family=` one for two reasons:
//   * `ital,wght@` maps 1:1 onto the ref's `style`/`weight`, so there is no guessing;
//   * for a VARIABLE family Google returns a STATIC instance cut at the requested weight. Fetching
//     the variable .ttf directly (e.g. from the google/fonts repo) would hand freetype a font it
//     renders at its DEFAULT instance — a request for weight 700 would silently draw Regular.
//
// The request must carry a legacy User-Agent: Google keys the response format off it, and a modern
// browser UA yields woff2, which drawtext cannot read.
export const GOOGLE_FONTS_USER_AGENT = 'Mozilla/4.0';

const GOOGLE_FONTS_CSS_ENDPOINT = 'https://fonts.googleapis.com/css2';

// Only a gstatic URL is ever followed. The pin is load-bearing for the SSRF guard: the CSS body
// decides what gets downloaded next, so it must not be able to point the fetch at another host.
const GSTATIC_TTF = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+?\.ttf)\)/;

export function googleCssUrl(ref: FontRef): string {
  const family = ref.family.trim().replace(/\s+/g, '+');
  const ital = ref.style === 'italic' ? 1 : 0;
  const weight = ref.weight ?? DEFAULT_FONT_WEIGHT;

  return `${GOOGLE_FONTS_CSS_ENDPOINT}?family=${family}:ital,wght@${ital},${weight}`;
}

// Pulls the TrueType URL out of a css2 response, or null when there is none — which is what a woff2
// response looks like, and is treated as a hard failure upstream rather than a silent skip.
export function extractTtfUrl(cssContent: string): string | null {
  const match = cssContent.match(GSTATIC_TTF);

  return match ? match[1] : null;
}
