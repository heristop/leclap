import 'reflect-metadata';
import { describe, expect, it } from 'vitest';

import { registerValidateTemplate } from '../src/tools/validateTemplate.js';

// Same fake-server trick as compose-video.test: capture the registered handler and call it directly.
type Handler = (args: Record<string, unknown>) => Promise<{
  isError?: boolean;
  content: { type: string; text: string }[];
  structuredContent?: Record<string, unknown>;
}>;

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
  it('validates an inline descriptor and reports no clips/fields for a color card', async () => {
    // A pure color card — no project_video clips, no form fields.
    const template: Record<string, unknown> = {
      global: { orientation: 'landscape' },
      sections: [{ name: 'card', type: 'color_background', options: { backgroundColor: '#0b0f14', duration: 3 } }],
    };
    const result = await setup()({ template });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({ valid: true, requiredClips: [], formFields: [] });
    expect(result.structuredContent?.sectionCount).toBeGreaterThan(0);
    expect(result.structuredContent?.geometry).toBeUndefined();
  });

  it('rejects an invalid inline template with a summarized message', async () => {
    const result = await setup()({ template: { sections: 'not-an-array' } });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid template');
  });

  // Regression guard: a project_video declared inside a `{type:'partial'}` section must surface in
  // requiredClips — the engine expands partials before rendering, so compose_video WILL demand a
  // clip for it, and this tool used to report no clips at all for such templates.
  it('lists a partial-provided project_video section in requiredClips', async () => {
    const template: Record<string, unknown> = {
      partials: [{ id: 'cam', sections: [{ name: 'clip', type: 'project_video', options: { duration: 3 } }] }],
      sections: [{ type: 'partial', ref: 'cam' }],
    };
    const result = await setup()({ template });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({ valid: true, requiredClips: ['clip'] });
  });
});
