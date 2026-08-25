import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectGeometryWarnings } from '@/services/geometry';
import type { TemplateDescriptor } from '@/schemas/template.schemas';

const currentDir = dirname(fileURLToPath(import.meta.url));
const fontsDir = join(currentDir, '../../leclap-creative-kit/src/library/fonts');

// The test is the caller, so the test owns the filesystem access — the module under test must not
// touch disk. Mirrors what the CLI will do in Task 8b.
const loadFont = async (fontFile: string): Promise<Uint8Array | null> => {
  try {
    return readFileSync(join(fontsDir, fontFile));
  } catch {
    return null;
  }
};

function templateWith(caption: Record<string, unknown>, orientation = 'landscape'): TemplateDescriptor {
  return {
    global: { orientation },
    sections: [{ type: 'color_background', name: 'a', options: { duration: 4 }, caption }],
  } as unknown as TemplateDescriptor;
}

describe('collectGeometryWarnings', () => {
  it('returns an empty array for a clean template', async () => {
    const warnings = await collectGeometryWarnings(templateWith({ text: { en: 'Short' }, fontsize: 40 }));

    expect(warnings).toEqual([]);
  });

  it('reports a caption that crosses the title-safe margin', async () => {
    // Wide enough to cross the margin, narrow enough to stay on screen — the finding an author can
    // fix by trimming a word rather than by rethinking the section.
    const template = templateWith({
      text: { en: 'A caption a fair bit wider than the title-safe band' },
      fontsize: 48,
    });

    const warnings = await collectGeometryWarnings(template);

    expect(warnings.some((w) => w.code === 'text_overflow')).toBe(true);
  });

  it('reports a caption that runs clean off the frame as out of frame, not merely unsafe', async () => {
    const template = templateWith({
      text: { en: 'This caption is far too long to fit inside the frame at this size' },
      fontsize: 90,
    });

    const warnings = await collectGeometryWarnings(template);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w) => w.code === 'text_out_of_frame')).toBe(true);
  });

  it('never returns an error severity', async () => {
    const warnings = await collectGeometryWarnings(templateWith({ text: { en: 'x'.repeat(400) }, fontsize: 80 }));

    for (const warning of warnings) {
      expect(warning.severity).toBe('warn');
    }
  });

  it('caps the report at 20 findings', async () => {
    const sections = Array.from({ length: 60 }, (_, i) => ({
      type: 'color_background',
      name: `s${i}`,
      options: { duration: 1 },
      caption: { text: { en: 'y'.repeat(300) }, fontsize: 80 },
    }));

    const warnings = await collectGeometryWarnings({ sections } as unknown as TemplateDescriptor);

    expect(warnings.length).toBeLessThanOrEqual(20);
  });

  it('does not throw when a template has no sections', async () => {
    await expect(collectGeometryWarnings({} as TemplateDescriptor)).resolves.toEqual([]);
  });

  it('marks every warning approximate when no loader is supplied', async () => {
    const warnings = await collectGeometryWarnings(templateWith({ text: { en: 'z'.repeat(200) }, fontsize: 80 }));

    expect(warnings.length).toBeGreaterThan(0);
    for (const warning of warnings) {
      expect(warning.approx).toBe(true);
    }
  });

  it('produces exact measurements when a loader is supplied', async () => {
    const warnings = await collectGeometryWarnings(
      templateWith({ text: { en: 'z'.repeat(200) }, fontsize: 80, font: 'rubik' }),
      loadFont
    );

    expect(warnings.length).toBeGreaterThan(0);
    for (const warning of warnings) {
      expect(warning.approx).toBe(false);
    }
  });

  it('falls back to approximation when the loader cannot find the font', async () => {
    const warnings = await collectGeometryWarnings(
      templateWith({ text: { en: 'z'.repeat(200) }, fontsize: 80 }),
      async () => null
    );

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.every((w) => w.approx)).toBe(true);
  });

  it('loads each distinct font once even when many sections share it', async () => {
    const calls: string[] = [];
    const counting = async (file: string): Promise<Uint8Array | null> => {
      calls.push(file);

      return loadFont(file);
    };

    const sections = Array.from({ length: 5 }, (_, i) => ({
      type: 'color_background',
      name: `s${i}`,
      options: { duration: 1 },
      caption: { text: { en: 'hello' }, fontsize: 40, font: 'rubik' },
    }));

    await collectGeometryWarnings({ sections } as unknown as TemplateDescriptor, counting);

    // Five sections, one typeface: the loader must be asked once, not once per section.
    expect(calls).toHaveLength(1);
  });

  // The defect this pins: sections lay out strictly sequentially with at most one box each, so two
  // captions can never share a time window and collisionWarnings was dead code on any real
  // descriptor. A lowerThird shares its section's window with the caption, so this is the one case
  // that can actually collide — built from a descriptor, not from hand-constructed Box[] like
  // geometry-rules.test.ts does.
  it('fires a collision warning when a caption and a lowerThird overlap in the same section', async () => {
    const template = {
      global: { orientation: 'landscape' },
      sections: [
        {
          type: 'color_background',
          name: 'a',
          options: { duration: 4 },
          caption: { text: { en: 'hello there' }, fontsize: 40, align: 'left', position: 'bottom' },
          lowerThird: { title: { en: 'World' }, subtitle: { en: 'subtitle line' } },
        },
      ],
    } as unknown as TemplateDescriptor;

    const warnings = await collectGeometryWarnings(template);

    expect(warnings.some((w) => w.code === 'text_collision')).toBe(true);
  });

  it('does not reject when the loader throws', async () => {
    const throwing = async (): Promise<Uint8Array | null> => {
      throw new Error('disk on fire');
    };

    // A broken loader degrades to approximation. Validation is advisory; it must not become the
    // thing that fails.
    await expect(
      collectGeometryWarnings(templateWith({ text: { en: 'hello' }, fontsize: 40 }), throwing)
    ).resolves.toBeInstanceOf(Array);
  });
});
