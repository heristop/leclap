// Colour helpers shared by the canvas box and the text-effect/sugar preview layers. Kept in a neutral
// module (imported by both) so sectionCanvasBox and textEffectCss don't import each other in a cycle.

// Parse a `#rgb`/`#rrggbb` hex into its [r, g, b] channel bytes, defaulting to black when malformed.
function hexChannels(hex: string): [number, number, number] {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.replace(/(.)/g, '$1$1') : raw;
  const int = Number.parseInt(full, 16);

  if (full.length !== 6 || !Number.isFinite(int)) return [0, 0, 0];

  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

// A CSS `rgba(...)` string for a hex color at the given [0,1] alpha, so the preview box matches the
// drawtext `boxcolor@opacity` the model emits. Used by the sugar preview layer, which renders the
// same `colour@opacity` drawbox/box tokens.
export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexChannels(hex);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
