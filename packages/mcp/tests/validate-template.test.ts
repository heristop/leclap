import 'reflect-metadata';
import { describe, expect, it } from 'vitest';

import { registerValidateTemplate } from '../src/tools/validateTemplate.js';

// Same fake-server trick as compose-video.test: capture the registered handler and call it directly.
type Handler = (args: Record<string, unknown>) => {
  isError?: boolean;
  content: { type: string; text: string }[];
  structuredContent?: Record<string, unknown>;
};

function setup(): Handler {
  let captured: Handler | undefined;
  const fakeServer = {
    registerTool: (_name: string, _meta: unknown, cb: Handler) => {
      captured = cb;
    },
  };

  registerValidateTemplate(fakeServer as never);

  if (!captured) {
    throw new Error('handler was not registered');
  }

  return captured;
}

describe('validate_template handler', () => {
  it('validates a built-in by name and reports its form fields', () => {
    const result = setup()({ templateName: 'intro' });

    expect(result.isError).toBeUndefined();
    // intro collects the title-card fields, then records one clip (video_1).
    expect(result.structuredContent).toMatchObject({ valid: true, requiredClips: ['video_1'] });
    expect(result.structuredContent?.formFields).toEqual(['form_1_firstname', 'form_1_lastname', 'form_1_job']);
  });

  it('validates an inline descriptor and reports no clips/fields for a color card', () => {
    // A pure color card — no project_video clips, no form fields.
    const template: Record<string, unknown> = {
      global: { orientation: 'landscape' },
      sections: [{ name: 'card', type: 'color_background', options: { backgroundColor: '#0b0f14', duration: 3 } }],
    };
    const result = setup()({ template });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({ valid: true, requiredClips: [], formFields: [] });
    expect(result.structuredContent?.sectionCount).toBeGreaterThan(0);
  });

  it('rejects an invalid inline template with a summarized message', () => {
    const result = setup()({ template: { sections: 'not-an-array' } });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid template');
  });

  it('rejects when both template and templateName are supplied', () => {
    const result = setup()({ template: {}, templateName: 'intro' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('exactly one');
  });

  it('rejects an unknown templateName', () => {
    const result = setup()({ templateName: 'does_not_exist' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unknown template');
  });
});
