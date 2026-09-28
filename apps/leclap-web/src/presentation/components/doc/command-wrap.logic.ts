// Where a wrapped terminal command may break. Left to the browser, a phone-width pill split inside a
// flag — `--field` wrapped as `-` / `-field`, which reads as two different flags. So a command breaks
// at its spaces only, and a token is kept whole unless it is longer than a line can hold (a path),
// where breaking inside is the lesser evil.

export interface CommandSegment {
  text: string;
  // Render without break opportunities inside.
  whole: boolean;
}

export function commandSegments(command: string, maxWhole: number): CommandSegment[] {
  return command
    .split(/(\s+)/)
    .filter((part) => part !== '')
    .map((part) => ({ text: part, whole: part.trim() !== '' && part.length <= maxWhole }));
}
