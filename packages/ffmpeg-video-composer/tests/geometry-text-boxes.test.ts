import { describe, it, expect } from 'vitest';
import { canvasFor, collectBoxes, collectSectionSpans } from '@/services/geometry/text-boxes';
import type { TemplateDescriptor } from '@/schemas/template.schemas';

// A stand-in for real font metrics: every glyph is half an em wide. Keeps these tests about
// geometry rather than about any particular typeface.
const halfEmMetrics = { unitsPerEm: 1000, advanceWidth: () => 500 };
const resolve = () => halfEmMetrics;

describe('canvasFor', () => {
  it('maps each orientation to its resolution preset', () => {
    expect(canvasFor('landscape')).toEqual({ width: 1280, height: 720 });
    expect(canvasFor('portrait')).toEqual({ width: 720, height: 1280 });
    expect(canvasFor('square')).toEqual({ width: 1080, height: 1080 });
  });

  it('defaults to landscape when unset', () => {
    expect(canvasFor(undefined)).toEqual({ width: 1280, height: 720 });
  });
});

describe('collectBoxes', () => {
  it('returns nothing for a template with no text', () => {
    const template = { sections: [{ type: 'color_background', name: 'plain' }] } as unknown as TemplateDescriptor;

    expect(collectBoxes(template, resolve)).toEqual([]);
  });

  it('produces one box per caption, carrying its descriptor path', () => {
    const template = {
      sections: [
        {
          type: 'color_background',
          name: 'a',
          options: { duration: 4 },
          caption: { text: { en: 'hello' }, fontsize: 40 },
        },
      ],
    } as unknown as TemplateDescriptor;

    const boxes = collectBoxes(template, resolve);

    expect(boxes).toHaveLength(1);
    expect(boxes[0].path).toBe('sections[0].caption');
    // 5 chars × 0.5em × 40px
    expect(boxes[0].width).toBeCloseTo(100, 5);
  });

  it('measures the longest locale when the caption text has several translations', () => {
    const template = {
      sections: [
        {
          type: 'color_background',
          name: 'a',
          options: { duration: 4 },
          caption: { text: { en: 'hi', fr: 'bonjour tout le monde' }, fontsize: 40 },
        },
      ],
    } as unknown as TemplateDescriptor;

    const [box] = collectBoxes(template, resolve);

    // "bonjour tout le monde" is 21 chars × 0.5em × 40px, not "hi"'s 2.
    expect(box.width).toBeCloseTo(420, 5);
  });

  it('spans the section duration when no explicit timing is given', () => {
    const template = {
      sections: [{ type: 'color_background', name: 'a', options: { duration: 6 }, caption: { text: { en: 'hi' } } }],
    } as unknown as TemplateDescriptor;

    const [box] = collectBoxes(template, resolve);

    expect(box.startSec).toBe(0);
    expect(box.endSec).toBe(6);
  });

  it('offsets later sections by the durations before them', () => {
    const template = {
      sections: [
        { type: 'color_background', name: 'a', options: { duration: 3 } },
        { type: 'color_background', name: 'b', options: { duration: 5 }, caption: { text: { en: 'hi' } } },
      ],
    } as unknown as TemplateDescriptor;

    const [box] = collectBoxes(template, resolve);

    expect(box.startSec).toBe(3);
    expect(box.endSec).toBe(8);
  });

  it('marks a box approximate when metrics are unavailable', () => {
    const template = {
      sections: [{ type: 'color_background', name: 'a', options: { duration: 2 }, caption: { text: { en: 'hi' } } }],
    } as unknown as TemplateDescriptor;

    const [box] = collectBoxes(template, () => null);

    expect(box.approx).toBe(true);
    expect(box.width).toBeGreaterThan(0);
  });

  it('falls back to a positional label instead of the literal string "undefined"', () => {
    const template = {
      sections: [{ type: 'color_background', options: { duration: 2 }, caption: { text: { en: 'hi' }, fontsize: 40 } }],
    } as unknown as TemplateDescriptor;

    const [box] = collectBoxes(template, resolve);

    expect(box.label).not.toContain('undefined');
    expect(box.label).toContain('sections[0]');
  });

  it('produces a box per lowerThird line (title and subtitle), carrying their own paths', () => {
    const template = {
      sections: [
        {
          type: 'color_background',
          name: 'a',
          options: { duration: 5 },
          lowerThird: { title: { en: 'Title' }, subtitle: { en: 'Subtitle text' } },
        },
      ],
    } as unknown as TemplateDescriptor;

    const boxes = collectBoxes(template, resolve);

    expect(boxes.map((b) => b.path)).toEqual(['sections[0].lowerThird.title', 'sections[0].lowerThird.subtitle']);
    // Both lines are on screen for the section's whole window, same as a caption.
    expect(boxes[0].startSec).toBe(0);
    expect(boxes[0].endSec).toBe(5);
  });

  it('omits a lowerThird line that has no text', () => {
    const template = {
      sections: [
        { type: 'color_background', name: 'a', options: { duration: 5 }, lowerThird: { title: { en: 'Only title' } } },
      ],
    } as unknown as TemplateDescriptor;

    const boxes = collectBoxes(template, resolve);

    expect(boxes).toHaveLength(1);
    expect(boxes[0].path).toBe('sections[0].lowerThird.title');
  });

  it('anchors a lowerThird to the top of the frame when position is "top"', () => {
    const template = {
      sections: [
        {
          type: 'color_background',
          name: 'a',
          options: { duration: 5 },
          lowerThird: { title: { en: 'Title' }, position: 'top' },
        },
      ],
    } as unknown as TemplateDescriptor;

    const [box] = collectBoxes(template, resolve);

    // Bottom-anchored (the default) would sit far down the frame; top-anchored stays near the top.
    expect(box.y).toBeLessThan(200);
  });

  it('collects a caption and a lowerThird from the same section as separate, co-temporal boxes', () => {
    const template = {
      sections: [
        {
          type: 'color_background',
          name: 'a',
          options: { duration: 5 },
          caption: { text: { en: 'caption' }, fontsize: 40 },
          lowerThird: { title: { en: 'Title' }, subtitle: { en: 'Sub' } },
        },
      ],
    } as unknown as TemplateDescriptor;

    const boxes = collectBoxes(template, resolve);

    expect(boxes).toHaveLength(3);
    expect(boxes.every((b) => b.startSec === 0 && b.endSec === 5)).toBe(true);
  });

  it('clamps the cursor at 0 so a negative-duration section cannot rewind later timelines', () => {
    const template = {
      sections: [
        { type: 'color_background', name: 'a', options: { duration: -3 } },
        { type: 'color_background', name: 'b', options: { duration: 4 }, caption: { text: { en: 'hi' } } },
      ],
    } as unknown as TemplateDescriptor;

    const [box] = collectBoxes(template, resolve);

    // Without the clamp this would be -3, corrupting every box after the bad section.
    expect(box.startSec).toBe(0);
    expect(box.endSec).toBe(4);
  });
});

describe('collectSectionSpans', () => {
  it('returns one span per section regardless of whether it carries text', () => {
    const template = {
      sections: [
        { type: 'color_background', name: 'a', options: { duration: 3 } },
        { type: 'color_background', name: 'b', options: { duration: -1 } },
      ],
    } as unknown as TemplateDescriptor;

    const spans = collectSectionSpans(template);

    expect(spans).toEqual([
      { path: 'sections[0]', label: 'Section "a"', duration: 3 },
      { path: 'sections[1]', label: 'Section "b"', duration: -1 },
    ]);
  });

  it('falls back to a positional label for an unnamed section', () => {
    const template = {
      sections: [{ type: 'color_background', options: { duration: 3 } }],
    } as unknown as TemplateDescriptor;

    const [span] = collectSectionSpans(template);

    expect(span.label).not.toContain('undefined');
    expect(span.label).toContain('sections[0]');
  });
});
