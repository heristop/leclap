// The eyebrow above a doc heading is set in tracked uppercase — right for "Schema-driven", wrong for
// `options.audioFade`, which uppercasing turns into an identifier that doesn't exist. A kicker wrapped
// in backticks (the Markdown convention) is a code identifier and keeps its case.

export interface Kicker {
  text: string;
  code: boolean;
}

export function parseKicker(kicker: string): Kicker {
  if (kicker.length > 2 && kicker.startsWith('`') && kicker.endsWith('`')) {
    return { text: kicker.slice(1, -1), code: true };
  }

  return { text: kicker, code: false };
}
