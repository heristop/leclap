// The MCP reference data behind /doc/mcp. Mirrors packages/leclap-mcp (src/server.ts, src/config.ts
// and the per-tool input schemas) — tool names, arguments, config keys and defaults must match the
// server, so change them together.

export interface McpToolDoc {
  name: string;
  /** The tool's input arguments, in the tools/list order. `?` marks an optional one. */
  args: string;
  purpose: string;
  when: string;
  /** Registered only behind `--allow-remotion`; rendered with an opt-in marker. */
  optIn?: boolean;
}

export interface McpConfigDoc {
  label: string;
  flag: string;
  env: string;
  /** The value the server falls back to with neither flag nor env set. */
  fallback: string;
  detail: string;
}

export interface McpDoc {
  id: 'mcp';
  title: string;
  intro: string;
  flow: string[];
  tools: McpToolDoc[];
  config: McpConfigDoc[];
  sampleConfig: string;
  projectConfig: string;
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
      args: 'no arguments',
      purpose: 'Returns the authoritative JSON Schema for the template descriptor plus a short authoring guide.',
      when: 'Use before authoring or modifying descriptor JSON.',
    },
    {
      name: 'validate_template',
      args: 'template',
      purpose:
        'Dry-runs validation of an inline descriptor — no render. Returns valid, sectionCount, orientation, requiredClips and formFields, plus an optional geometry array listing text that would overflow the frame, collide with other text, or render too small to read.',
      when: 'Use repeatedly to iterate on the descriptor before a slower render. The geometry findings are advisory — valid stays true — and the field is absent when there is nothing to fix.',
    },
    {
      name: 'compose_video',
      args: 'template, fields?, userVideoPaths?, locale?, outputBaseName?',
      purpose:
        'Validates then renders an inline descriptor. Returns outputPath, durationSeconds, sizeBytes, videoCodec, audioCodec and renderId, plus a resource_link to the mp4.',
      when: 'Use after validation succeeds and every project_video section has a clip in userVideoPaths.',
    },
    {
      name: 'probe_media',
      args: 'path',
      purpose: 'Inspects a local media file and reports codecs, duration, sample rate, and size.',
      when: 'Use to check a user-supplied clip before composing. The path must resolve inside the media dir.',
    },
    {
      name: 'render_remotion_clip',
      args: 'compositionId, entry?, serveUrl?, inputProps?, outputName?',
      purpose:
        'Renders a composition from your own Remotion project to an MP4 clip — motion graphics FFmpeg cannot express.',
      when: 'For an animated intro: render the clip, then feed it to compose_video as a project_video via userVideoPaths.',
      optIn: true,
    },
    {
      name: 'ping',
      args: 'no arguments',
      purpose: 'Liveness check — returns a fixed readiness string.',
      when: 'Use to confirm the server is up before a longer session.',
    },
  ],
  config: [
    {
      label: 'Output dir',
      flag: '--output-dir',
      env: 'LECLAP_MCP_OUTPUT_DIR',
      fallback: '~/.leclap/renders',
      detail: 'Where renders land — one folder per renderId.',
    },
    {
      label: 'Media allowlist',
      flag: '--media-dir',
      env: 'LECLAP_MCP_MEDIA_DIR',
      fallback: '~/.leclap/media',
      detail:
        'The containment root for local input files. The default is deliberately narrow: pointing it at your home directory would let any tool call read the whole of $HOME.',
    },
    {
      label: 'Remotion opt-in',
      flag: '--allow-remotion',
      env: 'LECLAP_MCP_ALLOW_REMOTION',
      fallback: 'off',
      detail:
        'render_remotion_clip bundles and executes a caller-supplied entry — arbitrary local JS. Without this the tool is never registered and never appears in tools/list.',
    },
    {
      label: 'Remotion entry',
      flag: '--remotion-entry',
      env: 'LECLAP_MCP_REMOTION_ENTRY',
      fallback: 'none',
      detail: 'A default entry module (the one that calls registerRoot) so calls can omit the entry argument.',
    },
    {
      label: 'Render timeout',
      flag: '--render-timeout-ms',
      env: 'LECLAP_MCP_RENDER_TIMEOUT_MS',
      fallback: '600000 (10 minutes)',
      detail: 'How long a single render may run before the worker is killed.',
    },
  ],
  // Mirrors the one-click editor deep-links in docMarkdown.ts, which install via npx. Env values are
  // absolute because they are not tilde-expanded.
  sampleConfig: JSON.stringify(
    {
      mcpServers: {
        leclap: {
          command: 'npx',
          args: ['-y', '@leclap/mcp'],
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
  // What `leclap init --mcp --remotion` writes as the project's .mcp.json: the media dir is scoped to
  // the project, and the Remotion opt-in is set because the scaffold ships a remotion/ entry.
  projectConfig: JSON.stringify(
    {
      mcpServers: {
        leclap: {
          command: 'npx',
          args: ['@leclap/mcp'],
          env: {
            LECLAP_MCP_MEDIA_DIR: '/abs/path/to/my-video',
            LECLAP_MCP_OUTPUT_DIR: '/abs/path/to/my-video/build',
            LECLAP_MCP_REMOTION_ENTRY: '/abs/path/to/my-video/remotion/index.ts',
            LECLAP_MCP_ALLOW_REMOTION: '1',
          },
        },
      },
    },
    null,
    2
  ),
};
