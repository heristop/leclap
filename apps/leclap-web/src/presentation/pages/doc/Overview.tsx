import { Seo } from '@/presentation/components/Seo';
import { DocSection, Prose, Code, Callout, RefTable, CliGetStarted } from '@/presentation/components/doc/DocBlocks';
import { docGroups } from '@/presentation/components/doc/schemaFields';
import { DocPageHeader } from './DocLayout';

export const DocOverview = () => (
  <>
    <Seo
      title="Template descriptor — overview"
      description="What the LeClap template descriptor is, the two layers you compose with, how rendering chooses its path, and how to get started with the CLI."
      path="/doc"
    />

    <DocPageHeader kicker="Shape" title="The template descriptor">
      A descriptor is a single JSON document the engine compiles into a finished video — the same source on Node, in the
      browser via WebAssembly, and on-device in React Native. Everything in this reference is generated from the
      engine's own schema, so it never drifts from what compiles.
    </DocPageHeader>

    <DocSection id="shape" title="The two keys" kicker="Structure">
      <Prose>
        <p>
          Every descriptor is a single object with two keys: <Code>{'{ global, sections[] }'}</Code>.{' '}
          <Code>global</Code> holds project-wide defaults; <Code>sections</Code> is an ordered list where each entry
          becomes one clip, composed in order. Both keys are optional so partial descriptors validate incrementally, but
          a useful template has at least one section. An optional <Code>meta</Code> object carries a human name and
          description.
        </p>
        <p>
          The descriptor has two layers you can mix freely. The{' '}
          <strong className="text-foreground">structured-sugar</strong> fields — <Code>transition</Code>,{' '}
          <Code>look</Code>, <Code>grade</Code>, <Code>motion</Code>, <Code>audio</Code>, <Code>layers</Code>,{' '}
          <Code>caption</Code> and <Code>framingGuide</Code> — are high-level intents that compile down to ordinary
          FFmpeg filters for you. Prefer this layer: it is portable, validated, and on-device-safe.
        </p>
        <p>
          When the sugar doesn't cover something, the raw <Code>filters[]</Code> and <Code>maps[]</Code> passthrough
          sends FFmpeg filter names and arguments through verbatim — so its keys stay FFmpeg-native (<Code>x</Code>,{' '}
          <Code>fontsize</Code>, <Code>boxcolor</Code>…), while sugar keys use editor-friendly camelCase. Keep the two
          mental models separate.
        </p>
        <p>
          <strong className="text-foreground">All durations are in seconds</strong>, everywhere —{' '}
          <Code>options.duration</Code>, <Code>transition.duration</Code>, <Code>audioFade.in.duration</Code>, and the
          rest.
        </p>
      </Prose>
    </DocSection>

    <DocSection id="rendering" title="How rendering works" kicker="Pipeline">
      <Prose className="mb-5">
        <p>
          Boundaries decide the render path. A <strong className="text-foreground">cut-only</strong> template
          concatenates its clips with a fast stream-copy — no re-encode, so it's quick even on-device.
        </p>
        <p>
          Any non-<Code>cut</Code> transition (a <Code>fade</Code>, <Code>wipeleft</Code>, …) triggers a single{' '}
          <Code>xfade</Code> / <Code>acrossfade</Code> re-encode pass that stitches the whole timeline together.
        </p>
      </Prose>
      <Callout label="Performance">
        Re-encoding is the expensive part. In the browser (WASM) and on-device, prefer cuts where you can, and keep
        transition durations short — every cross-fade pays a full decode/encode of the overlapping frames.
      </Callout>
    </DocSection>

    <DocSection id="get-started" title="Get started" kicker="CLI">
      <Prose className="mb-2">
        <p>Scaffold a project, install, and render — the fastest way to see a descriptor compile.</p>
      </Prose>
      <CliGetStarted />
    </DocSection>

    <DocSection id="global" title="Project-wide config" kicker="Reference">
      <Prose className="mb-5">
        <p>
          <Code>global</Code> sets defaults inherited by every section and declares what a builder UI may expose to end
          users. The audio sub-object has its own{' '}
          <a
            className="font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-300"
            href="/doc/audio"
          >
            page
          </a>
          .
        </p>
      </Prose>
      <div className="space-y-9">
        <RefTable
          id="meta"
          title="meta"
          summary="Optional template metadata — a display name and description."
          rows={docGroups.meta()}
        />
        <RefTable
          id="global-fields"
          title="global"
          summary="Project-wide defaults and the choices a builder exposes to users."
          rows={docGroups.global()}
        />
      </div>
    </DocSection>
  </>
);
