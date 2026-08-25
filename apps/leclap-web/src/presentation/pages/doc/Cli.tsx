import { Link } from 'react-router-dom';
import { Seo } from '@/presentation/components/Seo';
import {
  Callout,
  Code,
  CommandList,
  CommandPill,
  CliGetStarted,
  DefList,
  DocSection,
  Prose,
  Tip,
} from '@/presentation/components/doc/DocBlocks';
import { DocPageHeader } from './DocLayout';

// The CLI reference. Everything here mirrors packages/leclap-cli (src/index.ts and the command
// definitions under src/commands) — when a command, flag or resolution order changes there, it
// changes here.

// `leclap render` flags, in the order the command declares them. `meta` carries the short alias and
// the default, so the shape stays flag · alias/default · meaning.
const RENDER_FLAGS = [
  { term: '--output <path>', meta: '-o', children: 'Copy the finished mp4 somewhere else once the render succeeds.' },
  {
    term: '--field key=value',
    meta: 'repeatable',
    children: (
      <>
        Set a template variable or form value — the <Code>{'{{ placeholders }}'}</Code> in the descriptor.
      </>
    ),
  },
  {
    term: '--video section=path',
    meta: 'repeatable',
    children: (
      <>
        Supply the clip for a <Code>project_video</Code> section. Paths resolve against the working directory.
      </>
    ),
  },
  { term: '--locale <code>', meta: 'e.g. en, fr', children: 'Pick which translation of the localised text to draw.' },
  {
    term: '--orientation <value>',
    meta: 'landscape | portrait | square',
    children: (
      <>
        Override <Code>global.orientation</Code> for this render. A typo fails fast, before the compile starts.
      </>
    ),
  },
  { term: '--assets <dir>', meta: 'default: ./assets', children: 'Where the render reads media from.' },
  { term: '--build <dir>', meta: 'default: ./build', children: 'Where the render writes its output.' },
  {
    term: '--watch',
    meta: 'default: off',
    children: 'Re-render whenever the template or the assets it references change.',
  },
  { term: '--quiet', meta: '-q', children: 'Print only the final result line — no progress.' },
  {
    term: '--json',
    meta: 'default: off',
    children: (
      <>
        Emit a machine-readable result on stdout. Failures use the same shape (<Code>{'{ ok: false, error }'}</Code>)
        and still exit non-zero, so a script can parse one stream either way.
      </>
    ),
  },
  { term: '--verbose', meta: 'default: off', children: "Stream the underlying engine's own logs." },
] as const;

export const DocCli = () => (
  <>
    <Seo
      title="Command line — LeClap CLI"
      description="Scaffold a LeClap project and render a template descriptor to mp4 from your terminal: init, render, validate, diagnose, every render flag, and how FFmpeg is resolved."
      path="/doc/cli"
    />

    <DocPageHeader kicker="The human path" title="Command line">
      <Code>@leclap/cli</Code> is the manual front-end to the engine: write a <Code>template.json</Code>, drop media in{' '}
      <Code>assets/</Code>, render an mp4. <Code>init</Code> exists to take you from nothing to a first render in one
      command.
    </DocPageHeader>

    <DocSection id="quick-start" title="Quick start" kicker="One command to a first render">
      <CliGetStarted />
    </DocSection>

    <DocSection id="commands" title="Commands" kicker="Four verbs">
      <CommandList>
        <CommandPill command="leclap init [name]" label="scaffold a starter project that renders as-is" />
        <CommandPill command="leclap render <template>" label="compile a video from a template JSON" />
        <CommandPill
          command="leclap validate <template>"
          label="check a template against the schema and its text geometry, without rendering"
        />
        <CommandPill command="leclap diagnose" label="report which FFmpeg your environment provides" />
      </CommandList>
      <Prose>
        <p>
          <Code>leclap template.json</Code> is shorthand for <Code>leclap render template.json</Code> — any first
          argument that is not a known verb or a flag is treated as a template path. A render reads media from{' '}
          <Code>&lt;cwd&gt;/assets</Code> and writes output under <Code>&lt;cwd&gt;/build</Code>.
        </p>
        <p>
          <Code>leclap --help</Code> and <Code>leclap --version</Code> print the root screen; every subcommand has its
          own <Code>leclap &lt;command&gt; --help</Code>.
        </p>
      </Prose>
    </DocSection>

    <DocSection id="render" title="Rendering" kicker="render">
      <Prose>
        <p>
          <Code>render</Code> loads the descriptor, resolves FFmpeg, and compiles the sections in order. Everything a
          template leaves open — variables, the clips for <Code>project_video</Code> sections, the locale, the
          orientation, where media comes from and where the mp4 lands — is a flag, so the same{' '}
          <Code>template.json</Code> can produce a whole family of videos:
        </p>
      </Prose>
      <CommandList>
        <CommandPill
          command="leclap render template.json --field title=Summer --video intro=clips/intro.mp4"
          label="fill a variable and supply a clip"
        />
        <CommandPill
          command="leclap render template.json --orientation portrait -o out/reel.mp4"
          label="re-cut the same template vertically, into a named file"
        />
        <CommandPill command="leclap render template.json --watch" label="re-render on every edit while you author" />
        <CommandPill command="leclap render template.json --json --quiet" label="one parseable line, for CI" />
      </CommandList>
      <DefList rows={RENDER_FLAGS} />
      <Tip>
        <Code>validate</Code> takes the same template and the same <Code>--json</Code> flag, but never touches FFmpeg —
        it is the fast check to run in a pre-commit hook or before a long render. Beyond the schema, it also measures
        where each caption and lower third will land and warns about text that overflows the frame, collides with other
        text, or renders too small to read. Those warnings are advisory: they never change the exit code, so the command
        stays usable as a CI gate.
      </Tip>
    </DocSection>

    <DocSection id="init" title="Scaffolding a project" kicker="init">
      <Prose>
        <p>
          <Code>init</Code> writes a project that renders immediately: a <Code>template.json</Code> that needs no
          external media, a <Code>package.json</Code> with a <Code>render</Code> script, a README and an{' '}
          <Code>assets/</Code> folder. It detects the package manager you invoked it with — npm, pnpm, yarn or bun — and
          prints that one&apos;s install and run commands. It then asks whether to also wire two optional pieces:
        </p>
        <ul>
          <li>
            <strong>the MCP server</strong> (default yes) — a project-scoped <Code>.mcp.json</Code> pointing at{' '}
            <Code>@leclap/mcp</Code>, so an agent can author and render inside this project;
          </li>
          <li>
            <strong>a Remotion starter</strong> (default yes) — a self-contained <Code>remotion/</Code> project with an{' '}
            <Code>Intro</Code> composition, for animated intros. Choosing it also switches the starter template to a
            two-section one, with a <Code>project_video</Code> intro slot in front of the title card.
          </li>
        </ul>
        <p>Flags skip the prompts, which is what you want in CI (a non-TTY also auto-defaults):</p>
      </Prose>
      <CommandList>
        <CommandPill command="leclap init my-video --yes" label="accept all defaults (MCP + Remotion)" />
        <CommandPill command="leclap init my-video --no-mcp --no-remotion" label="bare CLI-render starter" />
        <CommandPill command="leclap init my-video --mcp --no-remotion" label="MCP wiring, no Remotion" />
      </CommandList>
      <Callout label="Absolute paths">
        The generated <Code>.mcp.json</Code> records absolute env paths for the machine that created it — the media dir
        is scoped to the project rather than your home directory. Move the project and you will need to regenerate or
        edit them.
      </Callout>
    </DocSection>

    <DocSection id="ffmpeg" title="FFmpeg" kicker="Resolution order">
      <Prose>
        <p>
          The engine looks for FFmpeg in this order: a system FFmpeg (fastest), then <Code>ffmpeg-static</Code>, then{' '}
          <Code>@ffmpeg/ffmpeg</Code> (WASM). Run <Code>leclap diagnose</Code> to see which one your environment
          actually provides.
        </p>
        <p>
          On pnpm 10 and later, dependency build scripts are skipped unless allow-listed — which is why the scaffolded{' '}
          <Code>package.json</Code> carries an <Code>onlyBuiltDependencies</Code> entry for <Code>ffmpeg-static</Code>.
          Without it the binary never unpacks and renders fail.
        </p>
      </Prose>
    </DocSection>

    <DocSection id="cli-or-mcp" title="CLI or MCP?" kicker="Two front-ends, one engine">
      <Prose>
        <p>
          Both drive the same engine and the same descriptor format. The CLI is the manual path — you write and render{' '}
          <Code>template.json</Code> yourself. The <Link to="/doc/mcp">MCP server</Link> is the agent path: an AI agent
          authors, validates and renders the same descriptors. A <Code>template.json</Code> produced by{' '}
          <Code>leclap init</Code> is equally usable by the MCP&apos;s <Code>compose_video</Code>, and{' '}
          <Code>leclap validate</Code> is the same check the MCP exposes as <Code>validate_template</Code>.
        </p>
      </Prose>
    </DocSection>
  </>
);
