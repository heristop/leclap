import { describe, it, expect } from 'vitest';
import { geometryLines } from '../src/tools/validateTemplate.js';
import type { TemplateDescriptor } from 'ffmpeg-video-composer';

describe('geometryLines', () => {
  it('returns undefined for a clean template so the field is omitted entirely', async () => {
    const template = {
      sections: [
        { type: 'color_background', name: 'a', options: { duration: 3 }, caption: { text: 'Hi', fontsize: 40 } },
      ],
    } as unknown as TemplateDescriptor;

    // Not an empty array: an absent field costs zero tokens, an empty array costs a few.
    const lines = await geometryLines(template);

    expect(lines).toBeUndefined();
  });

  it('returns one compact line per finding', async () => {
    const template = {
      sections: [
        {
          type: 'color_background',
          name: 'a',
          options: { duration: 3 },
          caption: { text: 'A caption far too long to fit in frame', fontsize: 96 },
        },
      ],
    } as unknown as TemplateDescriptor;

    const lines = await geometryLines(template);

    expect(lines).toBeDefined();
    expect(lines!.length).toBeGreaterThan(0);
    expect(lines![0]).toContain('sections[0].caption');
  });
});
