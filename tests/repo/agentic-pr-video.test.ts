import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TemplateDescriptorSchema } from '../../packages/ffmpeg-video-composer/src/schemas/section.schemas';

const examplePath = resolve(import.meta.dirname, '../../examples/agentic-pr-video/template.json');

describe('agentic PR video example', () => {
  it('is a valid LeClap template', () => {
    const descriptor = JSON.parse(readFileSync(examplePath, 'utf8'));

    expect(TemplateDescriptorSchema.safeParse(descriptor)).toMatchObject({ success: true });
  });

  it('keeps the recorded walkthrough and review focus explicit', () => {
    const descriptor = JSON.parse(readFileSync(examplePath, 'utf8'));

    expect(descriptor.global.variables).toMatchObject({
      project: expect.any(String),
      change: expect.any(String),
      reviewFocus: expect.any(String),
    });
    expect(descriptor.sections).toContainEqual(expect.objectContaining({ name: 'walkthrough', type: 'project_video' }));
  });
});
