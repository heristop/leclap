// How WIDE a run of text renders, split out of text-boxes.ts to keep that file under the max-lines
// budget — the same split that produced text-appearance.ts. text-boxes.ts owns where text lands;
// this owns how much room it takes.
import { measureTextWidth, type FontMetrics } from '@/core/font-metrics';

// Without real metrics, assume every glyph is 0.5em — roughly the Latin average. It is not
// conservative in either direction (Rubik averages ~0.49em, Oswald ~0.37em), so an estimated box is
// a guess, not a bound. That is exactly why every finding drawn from one is flagged `approx`.
const ASSUMED_ADVANCE_EM = 0.5;

// The section options that change the drawn string. `upperCase`/`lowerCase` live on the BASE section
// schema and are applied by FormatterManager.formatText to every text value in the section.
export interface TextCaseOptions {
  upperCase?: boolean;
  lowerCase?: boolean;
}

export interface Measurement {
  width: number;
  approx: boolean;
}

// caption.text (and lowerThird.title/subtitle) is a TranslationSchema (locale map) for every
// schema-valid template. The bare-string branch stays for callers that hand collectBoxes unvalidated
// input directly. Blank strings are dropped here rather than at the call site so the trim matches
// the engine's own `hasText` (editor/presets/text.ts) — a whitespace-only caption draws nothing, so
// modelling a box for it invents findings about text that never appears.
function localeCandidates(value: unknown): string[] {
  if (typeof value === 'string') {
    return value.trim() === '' ? [] : [value];
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  return Object.values(value as Record<string, unknown>).filter(
    (v): v is string => typeof v === 'string' && v.trim() !== ''
  );
}

// Code points, the same unit `measureTextWidth` iterates and drawtext advances by. `text.length`
// counts UTF-16 units instead, which doubles an NFD accent and reads one ZWJ family emoji as eleven
// characters — so the estimate and the measurement would disagree about the very same string for
// reasons that have nothing to do with the typeface. Counted rather than `[...text].length` because
// the repo's `no-misused-spread` rule forbids spreading a string.
function codePointCount(text: string): number {
  let count = 0;

  for (const _codePoint of text) {
    count++;
  }

  return count;
}

// A `{{ var }}` is substituted at render time, so a placeholder's width is a stand-in and never a
// fact — the same reason `captionFontFile` refuses to resolve a templated font id. Measuring it
// anyway beats silence, but the finding must not claim to be exact.
function isTemplated(text: string): boolean {
  return text.includes('{{');
}

// `options.upperCase` / `options.lowerCase` re-case EVERY text value in the section before drawtext
// sees it. Measuring the authored string instead of the drawn one is not a rounding error: uppercase
// Latin runs ~20% wider, so a caption measured at 1102px in Oswald actually paints 1341px on a
// 1280px frame — and was reported as clean, with `approx: false`.
function applyCase(text: string, options: TextCaseOptions | undefined): string {
  if (options?.upperCase) {
    return text.toUpperCase();
  }

  if (options?.lowerCase) {
    return text.toLowerCase();
  }

  return text;
}

// The widest locale wins, measured rather than counted: 24 "W"s render three times wider than 26
// "l"s, so picking the locale with the most UTF-16 code units drops real overflows and invents fake
// ones. Every locale is a candidate because any of them may be the one that ships.
export function measure(
  value: unknown,
  fontSize: number,
  metrics: FontMetrics | null,
  options?: TextCaseOptions
): Measurement | null {
  const candidates = localeCandidates(value);

  if (candidates.length === 0) {
    return null;
  }

  let width = 0;
  let approx = false;

  for (const authored of candidates) {
    const text = applyCase(authored, options);
    const exact = metrics && !isTemplated(text) ? measureTextWidth(metrics, text, fontSize) : null;
    const estimated = codePointCount(text) * ASSUMED_ADVANCE_EM * fontSize;

    approx = approx || exact === null;
    width = Math.max(width, exact ?? estimated);
  }

  return { width, approx };
}
