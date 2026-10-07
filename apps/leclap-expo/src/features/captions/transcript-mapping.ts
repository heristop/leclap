// Recogniser output (seconds into the recorded clip) → `subtitles.words` (seconds into the section).
// Applies the section's time edits the app exposes: `options.clip` (in/out points in source seconds)
// and `options.speed` (a PTS multiplier: 2 = slow motion, so section time = source time × speed).
// A word belongs to the section when its midpoint is inside the clip range; a word straddling an edge
// is clamped to it. The engine's own mapper (speed ramps, freezes, keep windows) covers the rest on
// Node; the app never authors those edits on a recorded clip.

export interface TranscriptWord {
  text: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
}

export interface SectionTimeEdits {
  clip?: { from?: number; to?: number };
  speed?: number;
}

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

function inRange(word: TranscriptWord, from: number, to: number): boolean {
  const mid = (word.start + word.end) / 2;

  return mid >= from && mid < to;
}

export function mapTranscriptWords(
  words: readonly TranscriptWord[],
  options: SectionTimeEdits | undefined
): TranscriptWord[] {
  const from = options?.clip?.from ?? 0;
  const to = options?.clip?.to ?? Number.POSITIVE_INFINITY;
  const speed = options?.speed && options.speed > 0 ? options.speed : 1;

  return words
    .filter((word) => inRange(word, from, to))
    .map((word) => ({
      ...word,
      start: round3((Math.max(word.start, from) - from) * speed),
      end: round3((Math.min(word.end, to) - from) * speed),
    }));
}

/** Phrase-level recogniser output split into words sharing each phrase window by character count. */
export function spreadSegments(segments: readonly TranscriptSegment[]): TranscriptWord[] {
  return segments.flatMap((segment) => {
    const tokens = segment.text.split(/\s+/).filter(Boolean);
    const total = tokens.reduce((sum, token) => sum + token.length, 0);
    let cursor = segment.start;

    return tokens.map((token) => {
      const start = cursor;
      cursor += ((segment.end - segment.start) * token.length) / total;

      return { text: token, start: round3(start), end: round3(cursor) };
    });
  });
}

/** Mean confidence of the words that carry one, or undefined when none does. */
export function meanConfidence(words: readonly TranscriptWord[]): number | undefined {
  const scored = words.flatMap((word) => (typeof word.confidence === 'number' ? [word.confidence] : []));

  if (scored.length === 0) return undefined;

  return round3(scored.reduce((sum, value) => sum + value, 0) / scored.length);
}
