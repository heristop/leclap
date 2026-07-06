import type { EditorSection } from '../templateEditorModel';
import { findMusic, MUSIC_LIBRARY, type MediaCredit } from '@/data/mediaCatalog';

// The non-visual section kinds the program monitor can't render a WYSIWYG frame for (music/form).
// `partial` routes to its own PartialPreview, so it's excluded here.
export type FallbackKind = 'music' | 'form';

export interface FallbackMeta {
  titleKey: string; // i18n key under the `admin` namespace
  subtitleKey: string;
}

// Copy for each fallback frame. Kept pure so the mapping is unit-tested and the component stays a
// thin renderer.
export function sectionFallbackMeta(kind: FallbackKind): FallbackMeta {
  if (kind === 'music') {
    return { titleKey: 'monitor.fallbackMusicTitle', subtitleKey: 'monitor.fallbackMusicSubtitle' };
  }

  return { titleKey: 'monitor.fallbackFormTitle', subtitleKey: 'monitor.fallbackFormSubtitle' };
}

// The field labels a form section collects, surfaced as chips so the frame is informative rather than
// blank. Falls back to the field `name` when a label hasn't been set, and drops empties.
export function formFieldChips(section: EditorSection): string[] {
  if (section.kind !== 'form') return [];

  return section.fields.map((field) => field.label.trim() || field.name.trim()).filter((label) => label !== '');
}

// The track a music section will lay under the video: its first allowed library track, else the
// bundled default — the same "first allowed, else library default" rule the image sections use for
// their backdrop (see EditorMonitor.imageSectionUrl). Lets the monitor play the actual audio.
export function musicSectionTrack(section: EditorSection): MediaCredit | null {
  if (section.kind !== 'music') return null;

  return findMusic(section.allowed.at(0) ?? '') ?? MUSIC_LIBRARY.at(0) ?? null;
}
