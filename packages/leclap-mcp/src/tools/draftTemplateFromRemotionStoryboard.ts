import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { TemplateDescriptor } from 'ffmpeg-video-composer';
import { z } from 'zod';

import { RemotionStoryboardSchema } from '../authoring/remotionStoryboard.js';
import { storyboardToTemplate } from '../authoring/storyboardToTemplate.js';
import { validateTemplate } from '../compose/validation.js';

const inputShape = {
  storyboard: RemotionStoryboardSchema,
};

const outputShape = {
  valid: z.boolean(),
  descriptor: z.record(z.string(), z.unknown()),
  sectionCount: z.number(),
  requiredClips: z.array(z.string()),
  formFields: z.array(z.string()),
};

type DraftArgs = { storyboard: unknown };
type ToolError = { isError: true; content: [{ type: 'text'; text: string }] };

function errorResult(text: string): ToolError {
  return { isError: true, content: [{ type: 'text', text }] };
}

function requiredClips(descriptor: TemplateDescriptor): string[] {
  return (descriptor.sections ?? [])
    .filter((section) => section.type === 'project_video' && typeof section.name === 'string')
    .map((section) => section.name as string);
}

export function registerDraftTemplateFromRemotionStoryboard(server: McpServer): void {
  server.registerTool(
    'draft_template_from_remotion_storyboard',
    {
      title: 'Draft Template From Remotion Storyboard',
      description:
        'Converts a Remotion-style storyboard JSON into a strict LeClap TemplateDescriptor. ' +
        'Use this after planning a video with Remotion Composition/Sequence concepts; then call validate_template.',
      inputSchema: inputShape,
      outputSchema: outputShape,
    },
    (args: DraftArgs) => {
      const parsed = RemotionStoryboardSchema.safeParse(args.storyboard);

      if (!parsed.success) {
        return errorResult(`Invalid Remotion storyboard: ${parsed.error.message}`);
      }

      const descriptor = storyboardToTemplate(parsed.data);
      const validation = validateTemplate(descriptor);

      if (!validation.ok) {
        return errorResult(validation.message);
      }

      const clips = requiredClips(validation.descriptor);

      return {
        content: [
          {
            type: 'text' as const,
            text: `Drafted valid template with ${validation.descriptor.sections?.length ?? 0} section(s). Required clips: ${
              clips.length > 0 ? clips.join(', ') : 'none'
            }.`,
          },
        ],
        structuredContent: {
          valid: true,
          descriptor: validation.descriptor,
          sectionCount: validation.descriptor.sections?.length ?? 0,
          requiredClips: clips,
          formFields: [],
        },
      };
    }
  );
}
