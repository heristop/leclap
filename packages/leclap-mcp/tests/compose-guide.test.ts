import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { registerComposeGuide } from '../src/prompts/composeGuide.js';

type Handler = (args: Record<string, unknown>) => unknown;

function captureHandler(): Handler {
  let captured: Handler | undefined;
  const fakeServer = {
    registerPrompt: (_name: string, _meta: unknown, cb: Handler) => {
      captured = cb;
    },
  };

  registerComposeGuide(fakeServer as never);

  if (!captured) {
    throw new Error('handler was not registered');
  }

  return captured;
}

describe('compose-video prompt', () => {
  it('guides agents to use Remotion as descriptor authoring help only', () => {
    const result = captureHandler()({ goal: 'a launch card', orientation: 'landscape' }) as {
      messages: { content: { text: string } }[];
    };
    const text = result.messages[0].content.text;

    expect(text).toContain('Optional Remotion-assisted authoring');
    expect(text).toContain('draft_template_from_remotion_storyboard');
    expect(text).toContain('Do not ask compose_video to render with Remotion');
  });
});
