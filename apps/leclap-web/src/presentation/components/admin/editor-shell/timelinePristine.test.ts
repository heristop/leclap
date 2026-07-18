import { describe, it, expect } from 'vitest';
import { isPristineTimeline } from './timelinePristine';
import { newSection, type EditorSection } from '../templateEditorModel';

describe('isPristineTimeline', () => {
  it('is true for the untouched cold-start default', () => {
    expect(isPristineTimeline([newSection('video')])).toBe(true);
  });

  it('is false once a second scene exists', () => {
    expect(isPristineTimeline([newSection('video'), newSection('color')])).toBe(false);
  });

  it('is false for a non-video single section', () => {
    expect(isPristineTimeline([newSection('color')])).toBe(false);
  });

  it('is false once the default section is edited', () => {
    const edited = { ...newSection('video'), duration: 12 } as EditorSection;
    expect(isPristineTimeline([edited])).toBe(false);

    const withOverlay = newSection('video');
    if (withOverlay.kind !== 'video') throw new Error('expected video');
    withOverlay.overlays = [
      {
        text: 'Hi',
        x: 0.5,
        y: 0.5,
        fontsize: 48,
        fontcolor: '#fff',
        font: 'default',
        box: false,
        boxcolor: '#000',
        boxOpacity: 0.5,
      },
    ];
    expect(isPristineTimeline([withOverlay])).toBe(false);
  });

  it('is false for an empty timeline', () => {
    expect(isPristineTimeline([])).toBe(false);
  });
});
