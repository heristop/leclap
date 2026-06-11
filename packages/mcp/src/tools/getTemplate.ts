import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { getTemplate, templateIds } from '../catalog/index.js';

const inputShape = {
  name: z.string(),
};

export function registerGetTemplate(server: McpServer): void {
  server.registerTool(
    'get_template',
    {
      title: 'Get Template',
      description:
        'Return the full JSON descriptor of one built-in template by id (see list_templates). Use ' +
        'it as a starting point: copy the returned descriptor, edit it, then pass it to compose_video.',
      inputSchema: inputShape,
    },
    ({ name }) => {
      const template = getTemplate(name);

      if (!template) {
        const valid = templateIds().join(', ');

        return {
          isError: true,
          content: [{ type: 'text', text: `Unknown template "${name}". Valid ids: ${valid}.` }],
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(template, null, 2) }],
        structuredContent: { template },
      };
    }
  );
}
