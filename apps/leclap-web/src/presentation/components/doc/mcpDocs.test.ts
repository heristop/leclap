import { describe, expect, it } from 'vitest';
import { mcpDoc } from './mcpDocs';

describe('mcpDoc', () => {
  it('documents the MCP authoring and rendering flow', () => {
    expect(mcpDoc.id).toBe('mcp');
    expect(mcpDoc.title).toContain('MCP');
    expect(mcpDoc.flow).toEqual(['get_template_schema', 'validate_template', 'compose_video']);
  });

  it('includes every tool the server registers', () => {
    const toolNames = mcpDoc.tools.map((tool) => tool.name);

    expect(toolNames).toEqual([
      'get_template_schema',
      'validate_template',
      'compose_video',
      'probe_media',
      'render_remotion_clip',
      'ping',
    ]);
  });

  it('no longer documents the removed catalog / storyboard tools', () => {
    const toolNames = mcpDoc.tools.map((tool) => tool.name);

    expect(toolNames).not.toContain('list_templates');
    expect(toolNames).not.toContain('get_remotion_authoring_guide');
    expect(toolNames).not.toContain('draft_template_from_remotion_storyboard');
  });

  it('marks render_remotion_clip as the only opt-in tool', () => {
    const optIn = mcpDoc.tools.filter((tool) => tool.optIn).map((tool) => tool.name);

    expect(optIn).toEqual(['render_remotion_clip']);
  });

  it('names each tool arguments so an agent knows what to pass', () => {
    const compose = mcpDoc.tools.find((tool) => tool.name === 'compose_video');

    expect(compose?.args).toBe('template, fields?, userVideoPaths?, locale?, outputBaseName?');
    expect(mcpDoc.tools.every((tool) => tool.args.length > 0)).toBe(true);
  });

  // The media dir defaults to a narrow ~/.leclap/media, NOT the home directory — documenting the
  // wider default would tell readers the server reads all of $HOME by default.
  it('reports the narrow media-dir default', () => {
    const mediaDir = mcpDoc.config.find((entry) => entry.env === 'LECLAP_MCP_MEDIA_DIR');

    expect(mediaDir?.fallback).toBe('~/.leclap/media');
    expect(mediaDir?.flag).toBe('--media-dir');
  });

  it('documents the Remotion opt-in, without which render_remotion_clip never registers', () => {
    const optIn = mcpDoc.config.find((entry) => entry.env === 'LECLAP_MCP_ALLOW_REMOTION');

    expect(optIn?.flag).toBe('--allow-remotion');
    expect(optIn?.fallback).toBe('off');
  });

  it('ships configs whose env paths are absolute — they are not tilde-expanded', () => {
    for (const raw of [mcpDoc.sampleConfig, mcpDoc.projectConfig]) {
      const parsed = JSON.parse(raw) as { mcpServers: { leclap: { env: Record<string, string> } } };
      const paths = Object.entries(parsed.mcpServers.leclap.env).filter(([key]) => key.endsWith('_DIR'));

      expect(paths.length).toBeGreaterThan(0);
      expect(paths.every(([, value]) => value.startsWith('/'))).toBe(true);
    }
  });
});
