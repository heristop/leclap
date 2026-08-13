import { Link } from 'react-router-dom';
import { Seo } from '@/presentation/components/Seo';
import { Callout, Code, CommandPill, CliGetStarted, DocSection, Prose } from '@/presentation/components/doc/DocBlocks';
import { DocPageHeader } from './DocLayout';

// The CLI reference. Everything here mirrors packages/leclap-cli/README.md — when a command, flag or
// resolution order changes there, it changes here.
export const DocCli = () => (
  <>
    <Seo
      title="Command line — LeClap CLI"
      description="Scaffold a LeClap project and render a template descriptor to mp4 from your terminal: init, render, diagnose, and how FFmpeg is resolved."
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
      <div className="space-y-2">
        <CommandPill command="leclap init [name]" label="scaffold a starter project" />
        <CommandPill command="leclap render <template>" label="compile a video from a template JSON" />
        <CommandPill command="leclap diagnose" label="check your FFmpeg setup" />
        <CommandPill command="leclap --help" label="usage — per-command help with leclap <command> --help" />
      </div>
      <Prose>
        <p>
          <Code>leclap template.json</Code> is shorthand for <Code>leclap render template.json</Code>. A render reads
          media from <Code>&lt;cwd&gt;/assets</Code> and writes output under <Code>&lt;cwd&gt;/build</Code>.
        </p>
      </Prose>
    </DocSection>

    <DocSection id="init" title="Scaffolding a project" kicker="init">
      <Prose>
        <p>
          <Code>init</Code> writes a project that renders immediately: a <Code>template.json</Code> that needs no
          external media, a <Code>package.json</Code>, a README and an <Code>assets/</Code> folder. It then asks whether
          to also wire two optional pieces:
        </p>
        <ul>
          <li>
            <strong>the MCP server</strong> (default yes) — a project-scoped <Code>.mcp.json</Code> pointing at{' '}
            <Code>@leclap/mcp</Code>, so an agent can author and render inside this project;
          </li>
          <li>
            <strong>a Remotion starter</strong> (default yes) — a self-contained <Code>remotion/</Code> project with an{' '}
            <Code>Intro</Code> composition, for animated intros.
          </li>
        </ul>
        <p>Flags skip the prompts, which is what you want in CI (a non-TTY also auto-defaults):</p>
      </Prose>
      <div className="space-y-2">
        <CommandPill command="leclap init my-video --yes" label="accept all defaults (MCP + Remotion)" />
        <CommandPill command="leclap init my-video --no-mcp --no-remotion" label="bare CLI-render starter" />
        <CommandPill command="leclap init my-video --mcp --no-remotion" label="MCP wiring, no Remotion" />
      </div>
      <Callout label="Absolute paths">
        The generated <Code>.mcp.json</Code> records absolute env paths for the machine that created it. Move the
        project and you will need to regenerate or edit them.
      </Callout>
    </DocSection>

    <DocSection id="ffmpeg" title="FFmpeg" kicker="Resolution order">
      <Prose>
        <p>
          The engine looks for FFmpeg in this order: a system FFmpeg (fastest), then <Code>ffmpeg-static</Code>, then{' '}
          <Code>@ffmpeg/ffmpeg</Code> (WASM). Run <Code>leclap diagnose</Code> to see which one your environment
          actually provides.
        </p>
      </Prose>
    </DocSection>

    <DocSection id="cli-or-mcp" title="CLI or MCP?" kicker="Two front-ends, one engine">
      <Prose>
        <p>
          Both drive the same engine and the same descriptor format. The CLI is the manual path — you write and render{' '}
          <Code>template.json</Code> yourself. The <Link to="/doc/mcp">MCP server</Link> is the agent path: an AI agent
          authors, validates and renders the same descriptors. A <Code>template.json</Code> produced by{' '}
          <Code>leclap init</Code> is equally usable by the MCP&apos;s <Code>compose_video</Code>.
        </p>
      </Prose>
    </DocSection>
  </>
);
