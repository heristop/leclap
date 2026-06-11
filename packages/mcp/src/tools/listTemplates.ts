import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { listTemplateSummaries, type TemplateSummary } from '../catalog/index.js';

// Raw zod shape (not z.object(...)) for the structured output, per the SDK contract.
const templateSummaryShape = {
  id: z.string(),
  description: z.string(),
  orientation: z.enum(['landscape', 'portrait']),
  musicEnabled: z.boolean(),
  requiredVideoSections: z.array(z.string()),
  fields: z.array(z.string()),
  requiresNetwork: z.boolean(),
};

const outputShape = {
  templates: z.array(z.object(templateSummaryShape)),
};

function formatLine(summary: TemplateSummary): string {
  const flags = [
    summary.orientation,
    summary.musicEnabled ? 'music' : 'no-music',
    summary.requiredVideoSections.length > 0
      ? `needs clips: ${summary.requiredVideoSections.join(', ')}`
      : 'no clips required',
    summary.requiresNetwork ? 'network' : 'offline',
  ].join(' · ');

  return `- ${summary.id} — ${summary.description} [${flags}]`;
}

function formatSummary(templates: TemplateSummary[]): string {
  const lines = templates.map(formatLine).join('\n');

  return `${templates.length} built-in templates (copy one and modify it):\n${lines}`;
}

export function registerListTemplates(server: McpServer): void {
  server.registerTool(
    'list_templates',
    {
      title: 'List Templates',
      description:
        'List the built-in video templates. Each is a starting point: copy one with get_template, ' +
        'tweak its global/sections, then pass it to compose_video. Returns id, description, ' +
        'orientation, whether music is on, which sections need user-supplied clips, declared form ' +
        'fields, and whether it references remote (http) assets.',
      outputSchema: outputShape,
    },
    () => {
      const templates = listTemplateSummaries();

      return {
        content: [{ type: 'text', text: formatSummary(templates) }],
        structuredContent: { templates },
      };
    }
  );
}
