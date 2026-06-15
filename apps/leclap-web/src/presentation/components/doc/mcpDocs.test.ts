import { describe, expect, it } from 'vitest';
import { mcpDoc } from './mcpDocs';

describe('mcpDoc', () => {
  it('documents the MCP authoring and rendering flow', () => {
    expect(mcpDoc.id).toBe('mcp');
    expect(mcpDoc.title).toContain('MCP');
    expect(mcpDoc.flow).toEqual([
      'get_template_schema',
      'get_remotion_authoring_guide',
      'draft_template_from_remotion_storyboard',
      'validate_template',
      'compose_video',
    ]);
  });

  it('includes the authoring tools and compose tool', () => {
    const toolNames = mcpDoc.tools.map((tool) => tool.name);

    expect(toolNames).toContain('get_remotion_authoring_guide');
    expect(toolNames).toContain('draft_template_from_remotion_storyboard');
    expect(toolNames).toContain('compose_video');
  });
});
