import { describe, it, expect } from 'vitest';
import { toggleOverlaySection, overlaySectionChoices } from './global-overlay-sections';

describe('toggleOverlaySection', () => {
  it('narrows an "every section" overlay (undefined) down to the toggled scene', () => {
    expect(toggleOverlaySection(undefined, 'video_1')).toEqual(['video_1']);
  });

  it('adds a scene not yet targeted', () => {
    expect(toggleOverlaySection(['video_1'], 'color_2')).toEqual(['video_1', 'color_2']);
  });

  it('removes an already-targeted scene', () => {
    expect(toggleOverlaySection(['video_1', 'color_2'], 'video_1')).toEqual(['color_2']);
  });

  it('collapses back to undefined (= every section) when the last scene is removed', () => {
    expect(toggleOverlaySection(['video_1'], 'video_1')).toBeUndefined();
  });
});

describe('overlaySectionChoices', () => {
  it('lists the template scene names in order', () => {
    expect(overlaySectionChoices(['video_1', 'color_2'], undefined)).toEqual(['video_1', 'color_2']);
  });

  it('appends stale targeted names missing from the template so they stay removable', () => {
    expect(overlaySectionChoices(['video_1'], ['video_1', 'clip_9'])).toEqual(['video_1', 'clip_9']);
  });

  it('does not duplicate names present in both lists', () => {
    expect(overlaySectionChoices(['video_1', 'image_1'], ['image_1'])).toEqual(['video_1', 'image_1']);
  });
});
