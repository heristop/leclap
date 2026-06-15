export interface McpToolDoc {
  name: string;
  purpose: string;
  when: string;
}

export interface McpDoc {
  id: 'mcp';
  title: string;
  intro: string;
  flow: string[];
  tools: McpToolDoc[];
  config: Array<{ label: string; value: string }>;
  sampleConfig: string;
}

export const mcpDoc: McpDoc = {
  id: 'mcp',
  title: 'MCP for agents',
  intro:
    'The LeClap MCP server exposes this same descriptor engine to local AI agents. The agent authors JSON, the MCP server validates it, and compose_video renders a deterministic MP4 through the existing FFmpeg pipeline.',
  flow: [
    'get_template_schema',
    'get_remotion_authoring_guide',
    'draft_template_from_remotion_storyboard',
    'validate_template',
    'compose_video',
  ],
  tools: [
    {
      name: 'list_templates',
      purpose: 'Lists built-in templates with orientation, fields, required clips, and network requirements.',
      when: 'Start here when the agent needs a proven template to copy and adapt.',
    },
    {
      name: 'get_template_schema',
      purpose: 'Returns the authoritative JSON Schema for the template descriptor.',
      when: 'Use before authoring or modifying descriptor JSON.',
    },
    {
      name: 'get_remotion_authoring_guide',
      purpose: 'Maps Remotion Composition and Sequence concepts to LeClap descriptor fields.',
      when: 'Use when an agent wants Remotion-style timeline planning before producing JSON.',
    },
    {
      name: 'draft_template_from_remotion_storyboard',
      purpose: 'Converts a structured Remotion-style storyboard into a validated LeClap descriptor.',
      when: 'Use after timeline planning, before validate_template.',
    },
    {
      name: 'validate_template',
      purpose: 'Dry-runs descriptor validation and reports required clips and form fields.',
      when: 'Use repeatedly before a slower render.',
    },
    {
      name: 'compose_video',
      purpose: 'Renders a validated descriptor to MP4 and returns output metadata.',
      when: 'Use only after validation succeeds and required media paths are available.',
    },
  ],
  config: [
    { label: 'Output dir', value: 'LECLAP_MCP_OUTPUT_DIR or --output-dir' },
    { label: 'Media allowlist', value: 'LECLAP_MCP_MEDIA_DIR or --media-dir' },
    { label: 'Render timeout', value: 'LECLAP_MCP_RENDER_TIMEOUT_MS or --render-timeout-ms' },
  ],
  sampleConfig: JSON.stringify(
    {
      mcpServers: {
        leclap: {
          command: 'node',
          args: ['/abs/path/to/ffmpeg-video-composer/packages/mcp/dist/index.js'],
          env: {
            LECLAP_MCP_OUTPUT_DIR: '/abs/path/to/Movies/leclap-renders',
            LECLAP_MCP_MEDIA_DIR: '/abs/path/to/Movies',
          },
        },
      },
    },
    null,
    2
  ),
};
