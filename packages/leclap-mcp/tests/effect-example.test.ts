import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TemplateValidator } from 'ffmpeg-video-composer';

const example = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../examples/llm-remotion-title');

describe('JSON Remotion title reference project', () => {
  it('provides valid effect authoring JSON followed by an ordinary engine section', async () => {
    const template = JSON.parse(await fs.readFile(path.join(example, 'template.json'), 'utf8'));
    const result = new TemplateValidator().validateTemplate(template);
    expect(result.success, JSON.stringify(result.errors)).toBe(true);
    expect(template.sections[0].effect.id).toBe('leclap.title-reveal');
    expect(template.sections[1].type).toBe('color_background');
  });
});
