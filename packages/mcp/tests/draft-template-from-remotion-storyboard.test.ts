import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { registerDraftTemplateFromRemotionStoryboard } from '../src/tools/draftTemplateFromRemotionStoryboard.js';

type Handler = (args: Record<string, unknown>) => unknown;

function captureHandler(): Handler {
  let captured: Handler | undefined;
  const fakeServer = {
    registerTool: (_name: string, _meta: unknown, cb: Handler) => {
      captured = cb;
    },
  };

  registerDraftTemplateFromRemotionStoryboard(fakeServer as never);

  if (!captured) {
    throw new Error('handler was not registered');
  }

  return captured;
}

describe('draft_template_from_remotion_storyboard', () => {
  it('returns a valid descriptor and validation summary', () => {
    const result = captureHandler()({
      storyboard: {
        orientation: 'landscape',
        sequences: [
          {
            id: 'intro',
            duration: 2,
            background: { type: 'color', color: '#111111' },
            text: [{ value: 'Hello', position: 'center', style: 'bold' }],
          },
        ],
      },
    }) as { structuredContent?: Record<string, unknown>; isError?: boolean };

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent?.valid).toBe(true);
    expect(result.structuredContent?.descriptor).toMatchObject({
      global: { orientation: 'landscape' },
      sections: [{ name: 'intro', type: 'color_background' }],
    });
  });

  it('returns an MCP error for invalid storyboards', () => {
    const result = captureHandler()({
      storyboard: {
        orientation: 'landscape',
        sequences: [],
      },
    }) as { isError?: boolean; content: { text: string }[] };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid Remotion storyboard');
  });
});
