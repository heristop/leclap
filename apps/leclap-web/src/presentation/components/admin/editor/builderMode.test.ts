import { describe, it, expect } from 'vitest';
import type { TFunction } from 'i18next';
import { readBuilderMode, writeBuilderMode, BUILDER_MODE_KEY } from './builderMode';
import { SECTION_HINTS, effectsSummary, audioSummary, framingSummary } from './sectionHints';
import { type FramingGuide, type MotionEffect } from '../templateEditorModel';

// Stand-in translator: maps the admin summary-chip keys to their English values so the
// summary helpers can be unit-tested without the full i18next runtime.
const CHIPS: Record<string, string> = {
  'summaryChip.none': 'None',
  'summaryChip.default': 'Default',
  'summaryChip.off': 'Off',
  'summaryChip.kenBurns': 'Ken Burns',
  'summaryChip.customVolume': 'Custom volume',
  'summaryChip.fadeIn': 'Fade in',
  'summaryChip.fadeOut': 'Fade out',
  'summaryChip.fadeInOut': 'Fade in/out',
};

const fakeT = ((key: string) => CHIPS[key] ?? key) as unknown as TFunction<'admin'>;

// Minimal in-memory Storage stand-in for the persistence helpers.
function memoryStorage(seed: Record<string, string> = {}): Pick<Storage, 'getItem' | 'setItem'> {
  const map = new Map(Object.entries(seed));

  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

describe('builderMode persistence', () => {
  it('defaults to simple when storage is empty, missing, or invalid', () => {
    expect(readBuilderMode(memoryStorage())).toBe('simple');
    expect(readBuilderMode(undefined)).toBe('simple');
    expect(readBuilderMode(memoryStorage({ [BUILDER_MODE_KEY]: 'nonsense' }))).toBe('simple');
  });

  it('round-trips a written mode', () => {
    const storage = memoryStorage();
    writeBuilderMode(storage, 'advanced');

    expect(readBuilderMode(storage)).toBe('advanced');
  });

  it('never throws when storage access fails', () => {
    const throwing: Pick<Storage, 'getItem' | 'setItem'> = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };

    expect(readBuilderMode(throwing)).toBe('simple');
    expect(() => {
      writeBuilderMode(throwing, 'advanced');
    }).not.toThrow();
  });

  it('stays silent without storage', () => {
    expect(() => {
      writeBuilderMode(undefined, 'advanced');
    }).not.toThrow();
  });
});

describe('sectionHints', () => {
  it('covers every add-section kind', () => {
    expect(SECTION_HINTS).toEqual({
      video: 'Record yourself on camera',
      form: 'Ask the viewer for text to overlay',
      partial: 'Reuse a saved scene fragment',
      color: 'Solid color card with a title',
      music: 'Background track for the whole video',
      image: 'A photo backdrop with motion',
    });
  });

  it('summarises effects: none, look only, and look + ken burns', () => {
    const kenburns: MotionEffect[] = [{ type: 'kenburns', direction: 'in', intensity: 1.2 }];

    expect(effectsSummary(fakeT, undefined)).toBe('None');
    expect(effectsSummary(fakeT, 'cinematic')).toBe('Cinematic');
    expect(effectsSummary(fakeT, 'noir', kenburns)).toBe('Noir · Ken Burns');
  });

  it('summarises audio fades and volume overrides', () => {
    expect(audioSummary(fakeT, undefined, false)).toBe('Default');
    expect(audioSummary(fakeT, { in: { duration: 0.5 } }, false)).toBe('Fade in');
    expect(audioSummary(fakeT, { out: { duration: 0.5 } }, false)).toBe('Fade out');
    expect(audioSummary(fakeT, { in: { duration: 0.5 }, out: { duration: 0.5 } }, false)).toBe('Fade in/out');
    expect(audioSummary(fakeT, undefined, true)).toBe('Custom volume');
  });

  it('summarises the framing guide position or off', () => {
    expect(framingSummary(fakeT, undefined)).toBe('Off');

    const guide: FramingGuide = { type: 'silhouette', position: 'right', opacity: 0.5 };
    expect(framingSummary(fakeT, guide)).toBe('Right');
  });
});
