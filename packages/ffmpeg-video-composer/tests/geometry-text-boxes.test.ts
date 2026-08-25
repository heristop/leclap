import { describe, it, expect } from 'vitest';
import { canvasFor, collectBoxes, type Box } from '@/services/geometry/text-boxes';
import type { FontMetrics } from '@/core/font-metrics';
import type { TemplateDescriptor } from '@/schemas/template.schemas';

// A stand-in for real font metrics: every glyph is half an em wide. Keeps these tests about
// geometry rather than about any particular typeface.
const halfEmMetrics: FontMetrics = { unitsPerEm: 1000, advanceWidth: () => 500 };
const resolve: Resolve = () => halfEmMetrics;
const landscape = canvasFor('landscape');

type Resolve = (font: string) => FontMetrics | null;

// The default caption style is `bar`, which draws a background box with an 18px border — so the
// painted rectangle is 36px wider and taller than the glyphs themselves.
const BAR_PADDING = 36;

function boxesOf(template: unknown, canvas = landscape, metrics: Resolve = resolve): Box[] {
  return collectBoxes(template as TemplateDescriptor, canvas, metrics);
}

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

    expect(boxesOf(template)).toEqual([]);
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

    const boxes = boxesOf(template);

    expect(boxes).toHaveLength(1);
    expect(boxes[0].path).toBe('sections[0].caption');
    // 5 chars × 0.5em × 40px, plus the default `bar` style's background-box border on both sides.
    expect(boxes[0].width).toBeCloseTo(100 + BAR_PADDING, 5);
  });

  it('measures the widest locale when the caption text has several translations', () => {
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

    const [box] = boxesOf(template);

    // "bonjour tout le monde" is 21 chars × 0.5em × 40px, not "hi"'s 2.
    expect(box.width).toBeCloseTo(420 + BAR_PADDING, 5);
  });

  it('picks the locale that renders widest, not the one with the most characters', () => {
    // Real metrics, not the half-em stand-in: "W" is far wider than "l", so the shorter English
    // string is the one that overflows. Sorting locales by `.length` picks the German one and the
    // overflow is never reported.
    const wideGlyphs: Record<number, number> = { 0x57: 1000, 0x6c: 200 };
    const metrics = () => ({ unitsPerEm: 1000, advanceWidth: (cp: number) => wideGlyphs[cp] ?? 500 });
    const template = {
      sections: [
        {
          type: 'color_background',
          name: 'a',
          options: { duration: 4 },
          caption: { text: { en: 'WWWWWWWWWWWW', de: 'llllllllllllll' }, fontsize: 40 },
        },
      ],
    } as unknown as TemplateDescriptor;

    const [box] = boxesOf(template, landscape, metrics);

    // 12 × 1.0em × 40 = 480, beating the 14-character German string's 14 × 0.2em × 40 = 112.
    expect(box.width).toBeCloseTo(480 + BAR_PADDING, 5);
  });

  it('takes the caption size and font from the style preset, not from a fraction of the frame', () => {
    const asked: string[] = [];
    const metrics = (font: string) => {
      asked.push(font);

      return halfEmMetrics;
    };
    const template = {
      sections: [
        {
          type: 'color_background',
          name: 'a',
          options: { duration: 4 },
          caption: { text: { en: 'ab' }, style: 'bold' },
        },
      ],
    } as unknown as TemplateDescriptor;

    const [box] = boxesOf(template, landscape, metrics);

    // `bold` is BebasNeue at a fixed 72px — the same on every orientation — and draws no box.
    expect(asked).toEqual(['BebasNeue.ttf']);
    expect(box.fontSize).toBe(72);
    expect(box.width).toBeCloseTo(2 * 0.5 * 72, 5);
  });

  it('keeps the caption size fixed across orientations', () => {
    const template = {
      sections: [{ type: 'color_background', name: 'a', options: { duration: 4 }, caption: { text: { en: 'ab' } } }],
    } as unknown as TemplateDescriptor;

    const [wide] = boxesOf(template, canvasFor('landscape'));
    const [tall] = boxesOf(template, canvasFor('portrait'));

    // The engine's default `bar` preset is 46px whatever the frame; a height ratio made this 39.6px
    // landscape and 70.4px portrait, so portrait captions were measured 53% too wide.
    expect(wide.fontSize).toBe(46);
    expect(tall.fontSize).toBe(46);
  });

  it('anchors a caption a fixed number of pixels from the frame edge', () => {
    const template = {
      sections: [
        {
          type: 'color_background',
          name: 'a',
          options: { duration: 4 },
          caption: { text: { en: 'ab' }, position: 'lower-third' },
        },
      ],
    } as unknown as TemplateDescriptor;

    const canvas = canvasFor('portrait');
    const [box] = boxesOf(template, canvas);

    // captions.ts draws this at `(h-text_h)-110`: the GLYPH box's bottom edge sits 110px above the
    // frame's, and the default style's background box then extends 18px further on every side. A
    // 0.72 ratio put the whole thing ~200px too high on a 1280-tall frame.
    const glyphBottom = box.y + box.height - BAR_PADDING / 2;

    expect(canvas.height - glyphBottom).toBeCloseTo(110, 5);
  });

  it('centres the drawn box rather than parking its top edge at the half-way line', () => {
    const template = {
      sections: [
        {
          type: 'color_background',
          name: 'a',
          options: { duration: 4 },
          caption: { text: { en: 'ab' }, position: 'center' },
        },
      ],
    } as unknown as TemplateDescriptor;

    const [box] = boxesOf(template);

    expect(box.y + box.height / 2).toBeCloseTo(landscape.height / 2, 5);
  });

  it('uses an absolute left margin, matching the preset, rather than a share of the width', () => {
    const template = {
      sections: [
        {
          type: 'color_background',
          name: 'a',
          options: { duration: 4 },
          caption: { text: { en: 'ab' }, align: 'left' },
        },
      ],
    } as unknown as TemplateDescriptor;

    // 80px to the glyph box; the background box reaches 18px further left.
    expect(boxesOf(template, canvasFor('landscape'))[0].x).toBe(80 - BAR_PADDING / 2);
    expect(boxesOf(template, canvasFor('portrait'))[0].x).toBe(80 - BAR_PADDING / 2);
  });

  it('falls back to the estimate, and says so, when the font cannot render the text', () => {
    // A Latin-only face has no glyph for a CJK caption. Summing the missing advances as zero would
    // report a 0px-wide box: it fits any frame and overlaps nothing, so every rule stays silent.
    const latinOnly = () => ({ unitsPerEm: 1000, advanceWidth: (cp: number) => (cp < 0x250 ? 500 : null) });
    const template = {
      sections: [
        {
          type: 'color_background',
          name: 'a',
          options: { duration: 4 },
          caption: { text: { ja: 'これはとても長い字幕です' }, fontsize: 40 },
        },
      ],
    } as unknown as TemplateDescriptor;

    const [box] = boxesOf(template, landscape, latinOnly);

    expect(box.width).toBeGreaterThan(0);
    expect(box.approx).toBe(true);
  });

  it('never claims an exact measurement for text carrying a {{ variable }}', () => {
    const template = {
      sections: [
        {
          type: 'color_background',
          name: 'a',
          options: { duration: 4 },
          caption: { text: { en: '{{ headline }}' }, fontsize: 40 },
        },
      ],
    } as unknown as TemplateDescriptor;

    // The placeholder is a stand-in for text supplied at render time; measuring it is a guess.
    expect(boxesOf(template)[0].approx).toBe(true);
  });

  it('skips a caption whose only text is whitespace, the same as the engine does', () => {
    const template = {
      sections: [{ type: 'color_background', name: 'a', options: { duration: 4 }, caption: { text: { en: '   ' } } }],
    } as unknown as TemplateDescriptor;

    // `hasText` trims before deciding whether to emit a drawtext filter, so nothing is drawn — and a
    // box modelled for it would invent findings about text that never appears.
    expect(boxesOf(template)).toEqual([]);
  });

  it('falls back to landscape for an inherited-property orientation rather than producing NaN', () => {
    // `CANVASES['toString']` is a truthy Function, so `?? fallback` never fires and every derived
    // coordinate becomes NaN — which fails every comparison, silently passing every rule.
    expect(canvasFor('toString')).toEqual({ width: 1280, height: 720 });
    expect(canvasFor('__proto__')).toEqual({ width: 1280, height: 720 });
  });

  it('spans the section duration when no explicit timing is given', () => {
    const template = {
      sections: [{ type: 'color_background', name: 'a', options: { duration: 6 }, caption: { text: { en: 'hi' } } }],
    } as unknown as TemplateDescriptor;

    const [box] = boxesOf(template);

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

    const [box] = boxesOf(template);

    expect(box.startSec).toBe(3);
    expect(box.endSec).toBe(8);
  });

  it('marks a box approximate when metrics are unavailable', () => {
    const template = {
      sections: [{ type: 'color_background', name: 'a', options: { duration: 2 }, caption: { text: { en: 'hi' } } }],
    } as unknown as TemplateDescriptor;

    const [box] = boxesOf(template, landscape, () => null);

    expect(box.approx).toBe(true);
    expect(box.width).toBeGreaterThan(0);
  });

  it('falls back to a positional label instead of the literal string "undefined"', () => {
    const template = {
      sections: [{ type: 'color_background', options: { duration: 2 }, caption: { text: { en: 'hi' }, fontsize: 40 } }],
    } as unknown as TemplateDescriptor;

    const [box] = boxesOf(template);

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

    const boxes = boxesOf(template);

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

    const boxes = boxesOf(template);

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

    const [box] = boxesOf(template);

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

    const boxes = boxesOf(template);

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

    const [box] = boxesOf(template);

    // Without the clamp this would be -3, corrupting every box after the bad section.
    expect(box.startSec).toBe(0);
    expect(box.endSec).toBe(4);
  });
});
