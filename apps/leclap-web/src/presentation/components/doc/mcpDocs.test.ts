import { describe, expect, it } from 'vitest';
import { mcpDoc } from './mcpDocs';

describe('mcpDoc', () => {
  it('documents the MCP authoring and rendering flow', () => {
    expect(mcpDoc.id).toBe('mcp');
    expect(mcpDoc.title).toContain('MCP');
    expect(mcpDoc.flow).toEqual(['get_template_schema', 'validate_template', 'compose_video']);
  });

  it('includes the authoring, compose, and Remotion tools', () => {
    const toolNames = mcpDoc.tools.map((tool) => tool.name);

    expect(toolNames).toContain('get_template_schema');
    expect(toolNames).toContain('validate_template');
    expect(toolNames).toContain('compose_video');
    expect(toolNames).toContain('render_remotion_clip');
  });

  it('no longer documents the removed catalog / storyboard tools', () => {
    const toolNames = mcpDoc.tools.map((tool) => tool.name);

    expect(toolNames).not.toContain('list_templates');
    expect(toolNames).not.toContain('get_remotion_authoring_guide');
    expect(toolNames).not.toContain('draft_template_from_remotion_storyboard');
  });
});
