// Pure text logic for a global text overlay's localised map (global.overlays[].text): the builder
// edits the English entry, but a descriptor may carry more locales — mirror the caption pattern
// (captionFrom / captionDescriptorFrom): display en with a first-locale fallback, and merge the
// edit back over the existing map so a keystroke never clobbers the other translations.
import type { GlobalTextOverlay } from '../templateEditorModel';

// The string the builder shows for an overlay: English first, else the first non-empty translation.
export function overlayDisplayText(text: GlobalTextOverlay['text']): string {
  // `en` is typed as always-present, but an imported fr-only descriptor can lack it — keep the fallback.
  const en = text.en as string | undefined;

  return en ?? Object.values(text).find(Boolean) ?? '';
}

// The overlay with its English text replaced, every other locale preserved.
export function withOverlayText(overlay: GlobalTextOverlay, en: string): GlobalTextOverlay {
  return { ...overlay, text: { ...overlay.text, en } };
}
