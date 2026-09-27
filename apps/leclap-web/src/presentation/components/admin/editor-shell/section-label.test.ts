import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import en from '@/i18n/locales/en/admin.json';
import fr from '@/i18n/locales/fr/admin.json';
import de from '@/i18n/locales/de/admin.json';
import es from '@/i18n/locales/es/admin.json';
import itLocale from '@/i18n/locales/it/admin.json';
import { newOverlay, newSection, SECTION_KINDS, SECTION_LABELS, type EditorSection } from '../templateEditorModel';
import { sectionLabelKey, sectionTitle } from './section-label';

// The shared model's SECTION_LABELS are English-only; the shell names kinds through the admin bundle.
const lookup = (bundle: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle);

describe('sectionLabelKey', () => {
  it.each(SECTION_KINDS)('names the %s kind in every locale', (kind) => {
    for (const bundle of [en, fr, de, es, itLocale]) {
      expect(lookup(bundle, sectionLabelKey(kind))).toEqual(expect.stringMatching(/\S/));
    }
  });

  it('keeps the English labels in step with the shared model', () => {
    for (const kind of SECTION_KINDS) {
      expect(lookup(en, sectionLabelKey(kind))).toBe(SECTION_LABELS[kind]);
    }
  });
});

describe('sectionTitle', () => {
  const t = ((key: string) => lookup(en, key)) as unknown as TFunction<'admin'>;

  it('titles a video scene by its first written overlay', () => {
    const video = newSection('video') as Extract<EditorSection, { kind: 'video' }>;
    const scene = {
      ...video,
      overlays: [
        { ...newOverlay(), text: '  ' },
        { ...newOverlay(), text: ' Launch day ' },
      ],
    };

    expect(sectionTitle(scene, t)).toBe('Launch day');
  });

  it('falls back to the localized kind label', () => {
    expect(sectionTitle(newSection('music'), t)).toBe('Music selection');
    expect(sectionTitle({ ...newSection('video'), overlays: [] } as EditorSection, t)).toBe('Your video');
  });
});
