import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { REMOTION_AUTHORING_WORKFLOW, remotionAuthoringGuide } from '../authoring/remotionGuide.js';

const outputShape = {
  workflow: z.array(z.string()),
  guide: z.string(),
};

export function registerGetRemotionAuthoringGuide(server: McpServer): void {
  server.registerTool(
    'get_remotion_authoring_guide',
    {
      title: 'Get Remotion Authoring Guide',
      description:
        'Explains how an LLM should use Remotion Composition/Sequence concepts to draft a LeClap TemplateDescriptor. ' +
        'This is authoring guidance only; rendering still happens through compose_video.',
      outputSchema: outputShape,
    },
    () => {
      const guide = remotionAuthoringGuide();

      return {
        content: [{ type: 'text' as const, text: guide }],
        structuredContent: {
          workflow: [...REMOTION_AUTHORING_WORKFLOW],
          guide,
        },
      };
    }
  );
}
