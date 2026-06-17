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
    'The LeClap MCP server exposes this same descriptor engine to local AI agents. The agent authors a JSON descriptor from the schema, the server validates it, and compose_video renders a deterministic MP4 through the FFmpeg pipeline. It ships no template catalog; an optional render_remotion_clip turns your own Remotion project into an animated intro clip.',
  flow: ['get_template_schema', 'validate_template', 'compose_video'],
  tools: [
    {
      name: 'get_template_schema',
      purpose: 'Returns the authoritative JSON Schema for the template descriptor plus a short authoring guide.',
      when: 'Use before authoring or modifying descriptor JSON.',
    },
    {
      name: 'validate_template',
      purpose: 'Dry-runs validation of an inline descriptor and reports required clips and form fields.',
      when: 'Use repeatedly to iterate on the descriptor before a slower render.',
    },
    {
      name: 'compose_video',
      purpose: 'Renders an inline descriptor to MP4 and returns output metadata.',
      when: 'Use after validation succeeds and required media paths are available.',
    },
    {
      name: 'render_remotion_clip',
      purpose:
        'Renders a composition from your own Remotion project to an MP4 clip — motion graphics FFmpeg cannot express.',
      when: 'Optional: for an animated intro, then feed the clip to compose_video as a project_video via userVideoPaths. Needs @remotion/* and a configured entry.',
    },
    {
      name: 'probe_media',
      purpose: 'Inspects a local media file and reports codecs, duration, sample rate, and size.',
      when: 'Use to check a user-supplied clip before composing.',
    },
  ],
  config: [
    { label: 'Output dir', value: 'LECLAP_MCP_OUTPUT_DIR or --output-dir' },
    { label: 'Media allowlist', value: 'LECLAP_MCP_MEDIA_DIR or --media-dir' },
    { label: 'Remotion entry', value: 'LECLAP_MCP_REMOTION_ENTRY or --remotion-entry (for render_remotion_clip)' },
    { label: 'Render timeout', value: 'LECLAP_MCP_RENDER_TIMEOUT_MS or --render-timeout-ms' },
  ],
  sampleConfig: JSON.stringify(
    {
      mcpServers: {
        leclap: {
          command: 'node',
          args: ['/abs/path/to/ffmpeg-video-composer/packages/leclap-mcp/dist/index.js'],
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
