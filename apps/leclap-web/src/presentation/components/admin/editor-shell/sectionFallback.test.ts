import { describe, it, expect } from 'vitest';
import { sectionFallbackMeta, formFieldChips, musicSectionTrack } from './sectionFallback';
import { newSection } from '../templateEditorModel';
import { MUSIC_LIBRARY } from '@/data/mediaCatalog';

describe('sectionFallbackMeta', () => {
  it('gives music and form distinct copy keys', () => {
    expect(sectionFallbackMeta('music')).toEqual({
      titleKey: 'monitor.fallbackMusicTitle',
      subtitleKey: 'monitor.fallbackMusicSubtitle',
    });
    expect(sectionFallbackMeta('form').titleKey).toBe('monitor.fallbackFormTitle');
  });
});

describe('formFieldChips', () => {
  it('lists the form field labels', () => {
    const form = newSection('form');
    expect(formFieldChips(form)).toEqual(['Label']); // default label from the factory
  });

  it('falls back to the field name and drops empties', () => {
    const form = newSection('form');
    if (form.kind !== 'form') throw new Error('expected a form section');
    form.fields = [
      { name: 'email', label: '  ', maxLength: 40 },
      { name: '  ', label: 'Name', maxLength: 40 },
      { name: '  ', label: '  ', maxLength: 40 },
    ];
    expect(formFieldChips(form)).toEqual(['email', 'Name']);
  });

  it('returns nothing for non-form sections', () => {
    expect(formFieldChips(newSection('music'))).toEqual([]);
  });
});

describe('musicSectionTrack', () => {
  it('resolves the first allowed library track', () => {
    const section = newSection('music');
    if (section.kind !== 'music') throw new Error('expected a music section');
    const pick = MUSIC_LIBRARY.at(1) ?? MUSIC_LIBRARY.at(0);
    if (!pick) throw new Error('expected a bundled music library');
    section.allowed = [pick.id];

    expect(musicSectionTrack(section)).toEqual(pick);
  });

  it('falls back to the default library track when nothing is selected or the id is unknown', () => {
    const section = newSection('music');
    expect(musicSectionTrack(section)).toEqual(MUSIC_LIBRARY.at(0));

    if (section.kind !== 'music') throw new Error('expected a music section');
    section.allowed = ['nope'];
    expect(musicSectionTrack(section)).toEqual(MUSIC_LIBRARY.at(0));
  });

  it('returns nothing for non-music sections', () => {
    expect(musicSectionTrack(newSection('form'))).toBeNull();
  });
});
