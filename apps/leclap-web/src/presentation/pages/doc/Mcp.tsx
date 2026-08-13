import { Link } from 'react-router-dom';
import { Seo } from '@/presentation/components/Seo';
import { Callout, Code, CommandPill, DocSection, JsonBlock, Prose, Tip } from '@/presentation/components/doc/DocBlocks';
import { DocPageHeader } from './DocLayout';

// The MCP reference. Mirrors packages/leclap-mcp/README.md — tool names, config keys and defaults
// must match the server, so change them together.
const TOOLS: readonly { name: string; blurb: string }[] = [
  { name: 'get_template_schema', blurb: 'The JSON Schema for a template descriptor, plus a short authoring guide.' },
  {
    name: 'validate_template',
    blurb:
      'Dry-run an inline descriptor without rendering — returns valid, sectionCount, orientation, requiredClips and formFields.',
  },
  {
    name: 'compose_video',
    blurb:
      'Validate an inline descriptor and render it — returns outputPath, durationSeconds, sizeBytes, codecs and renderId, plus a resource_link to the mp4.',
  },
  { name: 'probe_media', blurb: 'Inspect a local media file: codecs, duration, sample rate, size.' },
  {
    name: 'render_remotion_clip',
    blurb:
      'Opt-in. Render a composition from your own Remotion project to an mp4 clip you can feed to a project_video section.',
  },
  { name: 'ping', blurb: 'Liveness check.' },
];

const CLAUDE_DESKTOP_CONFIG = `{
  "mcpServers": {
    "leclap": {
      "command": "npx",
      "args": ["-y", "@leclap/mcp"],
      "env": {
        "LECLAP_MCP_OUTPUT_DIR": "/abs/path/to/Movies/leclap-renders",
        "LECLAP_MCP_MEDIA_DIR": "/abs/path/to/Movies"
      }
    }
  }
}`;

export const DocMcp = () => (
  <>
    <Seo
      title="MCP server — agent-callable video tools"
      description="Expose the LeClap engine to an AI agent over MCP: the tool surface, the authoring loop, configuration, and wiring it into Claude Desktop."
      path="/doc/mcp"
    />

    <DocPageHeader kicker="The agent path" title="MCP server">
      <Code>@leclap/mcp</Code> exposes the engine as agent-callable tools. The agent is the LLM; the server helps it
      author a descriptor from the schema, then validates and renders it deterministically to an mp4.
    </DocPageHeader>

    <DocSection id="what" title="What it is" kicker="Authoring, not generating">
      <Prose>
        <p>
          The server ships <strong>no template catalog</strong> — it is decoupled from the app&apos;s creative kit, so
          it stays a generic authoring tool. The output is agent-composable, deterministic and reproducible video, which
          is the opposite of generative video: the same descriptor renders the same mp4 every time.
        </p>
      </Prose>
    </DocSection>

    <DocSection id="tools" title="Tools" kicker={`${TOOLS.length} tools`}>
      <dl className="space-y-4">
        {TOOLS.map((tool) => (
          <div key={tool.name}>
            <dt className="font-mono text-sm font-semibold text-foreground">{tool.name}</dt>
            <dd className="mt-1 max-w-[68ch] text-sm leading-6 text-gray-400">{tool.blurb}</dd>
          </div>
        ))}
      </dl>
      <Callout label="Typical flow">
        <Code>get_template_schema</Code> → author an inline descriptor → <Code>validate_template</Code> (instant,
        iterate until valid) → <Code>compose_video</Code> → open the returned <Code>outputPath</Code>.
      </Callout>
    </DocSection>

    <DocSection id="prompt" title="Guided prompt" kicker="compose-video">
      <Prose>
        <p>
          The server also ships a prompt, <Code>compose-video</Code>, which surfaces as <Code>/compose-video</Code> in
          clients like Claude Desktop. It takes optional <Code>goal</Code> and <Code>orientation</Code> arguments and
          primes the agent with the schema, the building-block recipes (which filters give which look, the bundled
          fonts, the on-device filter allowlist) and the validate → compose loop.
        </p>
      </Prose>
    </DocSection>

    <DocSection id="run" title="Run it" kicker="stdio">
      <CommandPill command="npx -y @leclap/mcp" label="published — no checkout needed" />
      <Prose>
        <p>
          It speaks MCP over stdio, where stdout is the protocol channel — every diagnostic goes to stderr, including
          render progress (<Code>[compose_video] render &lt;id&gt; NN%</Code>).
        </p>
      </Prose>
    </DocSection>

    <DocSection id="configuration" title="Configuration" kicker="Flags and env">
      <dl className="space-y-4">
        <div>
          <dt className="font-mono text-sm font-semibold text-foreground">--output-dir · LECLAP_MCP_OUTPUT_DIR</dt>
          <dd className="mt-1 text-sm leading-6 text-gray-400">
            Where renders land, one folder per <Code>renderId</Code>. Defaults to <Code>~/.leclap/renders</Code>.
          </dd>
        </div>
        <div>
          <dt className="font-mono text-sm font-semibold text-foreground">--media-dir · LECLAP_MCP_MEDIA_DIR</dt>
          <dd className="mt-1 text-sm leading-6 text-gray-400">
            The allowlist for local input files. Defaults to your home directory.
          </dd>
        </div>
        <div>
          <dt className="font-mono text-sm font-semibold text-foreground">
            --render-timeout-ms · LECLAP_MCP_RENDER_TIMEOUT_MS
          </dt>
          <dd className="mt-1 text-sm leading-6 text-gray-400">
            How long a single render may run. Defaults to 600000 (10 minutes).
          </dd>
        </div>
      </dl>
      <Callout label="Containment">
        Local input paths — <Code>userVideoPaths</Code> and <Code>probe_media</Code> — must resolve inside the media
        dir. The check is symlink-safe, so a link pointing outside is rejected rather than followed.
      </Callout>
    </DocSection>

    <DocSection id="claude-desktop" title="Claude Desktop" kicker="claude_desktop_config.json">
      <JsonBlock code={CLAUDE_DESKTOP_CONFIG} />
      <Tip>
        Use absolute paths — env values are not tilde-expanded. From a checkout, swap the command for <Code>node</Code>{' '}
        and point it at <Code>packages/leclap-mcp/dist/index.js</Code>.
      </Tip>
      <Prose>
        <p>
          Then ask for a video in plain language and the agent fetches the schema, authors a descriptor, validates it
          and renders. There is no catalog to browse: the server authors templates rather than serving stock ones.
        </p>
      </Prose>
    </DocSection>

    <DocSection id="remotion" title="Remotion intros" kicker="Optional, bring your own">
      <Prose>
        <p>
          <Code>render_remotion_clip</Code> renders a composition from <em>your</em> Remotion project — spring physics
          and kinetic typography an FFmpeg filtergraph cannot express — to an mp4. Feed that clip back to{' '}
          <Code>compose_video</Code> as a <Code>project_video</Code> and the engine composites it in front of your
          scenes. It needs the optional peer deps <Code>@remotion/renderer</Code> and <Code>@remotion/bundler</Code>,
          and is design-time only (headless Chromium). Everything else in the server stays self-contained and on-device.
          The <Link to="/doc/cli">CLI</Link> never needs it.
        </p>
      </Prose>
    </DocSection>
  </>
);
