import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { registerGetRemotionAuthoringGuide } from '../src/tools/getRemotionAuthoringGuide.js';

type Handler = (args: Record<string, unknown>) => unknown;

function captureHandler(): Handler {
  let captured: Handler | undefined;
  const fakeServer = {
    registerTool: (_name: string, _meta: unknown, cb: Handler) => {
      captured = cb;
    },
  };

  registerGetRemotionAuthoringGuide(fakeServer as never);

  if (!captured) {
    throw new Error('handler was not registered');
  }

  return captured;
}

describe('get_remotion_authoring_guide', () => {
  it('returns Remotion-to-LeClap mapping guidance', () => {
    const result = captureHandler()({}) as { content: { text: string }[]; structuredContent?: Record<string, unknown> };

    expect(result.content[0].text).toContain('Composition');
    expect(result.content[0].text).toContain('Sequence');
    expect(result.content[0].text).toContain('TemplateDescriptor');
    expect(result.structuredContent?.workflow).toEqual(
      expect.arrayContaining(['plan_storyboard', 'draft_template', 'validate_template', 'compose_video'])
    );
  });
});
