import type { TFunction } from 'i18next';
import type { EditorSection } from '../templateEditorModel';

// The admin-bundle key naming a scene kind ("Your video", "Ta vidéo"…). The shared model's
// SECTION_LABELS are English-only, so every label the shell shows resolves through i18n instead.
export const sectionLabelKey = (kind: EditorSection['kind']) => `editor.sectionLabel.${kind}` as const;

// A readable timeline title for a scene: a video scene's first non-empty text overlay, else its kind.
export function sectionTitle(section: EditorSection, t: TFunction<'admin'>): string {
  if (section.kind === 'video') {
    const text = section.overlays.find((o) => o.text.trim() !== '')?.text.trim();

    if (text) return text;
  }

  return t(sectionLabelKey(section.kind));
}
