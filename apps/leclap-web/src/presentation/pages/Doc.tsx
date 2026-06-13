import { useState } from 'react';
import { BookOpen, Code2, ChevronDown } from 'lucide-react';
import {
  XFADE_TRANSITIONS,
  AFADE_CURVES,
  LOOK_PRESETS,
  templateDescriptorJsonSchema,
} from 'ffmpeg-video-composer/src/schemas/template.schemas.ts';
import { transitionGroups } from '@/presentation/components/admin/editor/transitionGroups';
import { Seo } from '@/presentation/components/Seo';
import { Badge } from '@/presentation/components/ui';
import {
  DocSection,
  Prose,
  Code,
  FieldTable,
  ChipList,
  JsonBlock,
  Callout,
} from '@/presentation/components/doc/DocBlocks';
import { fieldGroups } from '@/presentation/components/doc/schemaFields';
import { examples } from '@/presentation/components/doc/examples';

const REPO = 'https://github.com/heristop/ffmpeg-video-composer';
const groups = fieldGroups();

const toc = [
  { id: 'overview', label: 'Overview' },
  { id: 'rendering', label: 'How rendering works' },
  { id: 'transitions', label: 'Transitions' },
  { id: 'looks', label: 'Looks & grade' },
  { id: 'curves', label: 'Audio fade curves' },
  { id: 'fields', label: 'Field reference' },
  { id: 'examples', label: 'Examples' },
  { id: 'schema', label: 'Raw JSON Schema' },
] as const;

// Sticky, keyboard-navigable in-page nav (desktop only — it folds into the flow on
// narrow screens where the content already reads top-to-bottom).
const TableOfContents = () => (
  <nav aria-label="On this page" className="hidden lg:block sticky top-28 self-start">
    <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-gray-500">On this page</p>
    <ul className="space-y-1 border-l border-divider">
      {toc.map((item) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            className="-ml-px block border-l-2 border-transparent py-1 pl-4 text-sm text-gray-400 transition-colors hover:border-brand-400 hover:text-foreground focus-visible:border-brand-400 focus-visible:text-foreground"
          >
            {item.label}
          </a>
        </li>
      ))}
    </ul>
  </nav>
);

const RawSchema = () => {
  const [open, setOpen] = useState(false);
  const json = JSON.stringify(templateDescriptorJsonSchema, null, 2);

  return (
    <div className="rounded-2xl border border-divider bg-surface/60">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
        }}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="text-sm font-medium text-foreground">
          Generated JSON Schema <span className="text-gray-500">({json.length.toLocaleString()} chars)</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div className="border-t border-divider p-4">
          <JsonBlock code={json} />
        </div>
      ) : null}
    </div>
  );
};

export const Doc = () => (
  <div className="min-h-[calc(100vh-4rem)] bg-background text-foreground">
    <Seo
      title="Template descriptor reference"
      description="Developer reference for the LeClap template descriptor — the JSON document compiled to FFmpeg, with the live transition, look and curve catalogues."
      path="/doc"
    />

    {/* Header band */}
    <div className="border-b border-divider bg-surface/40">
      <div className="container mx-auto max-w-6xl px-4 pt-28 pb-12">
        <Badge variant="brand">
          <BookOpen className="mr-1 h-3.5 w-3.5" /> Developer reference
        </Badge>
        <h1 className="mt-4 max-w-[18ch] text-[length:var(--text-display-sm)] font-display font-bold tracking-tight text-foreground">
          The template descriptor
        </h1>
        <p className="mt-3 max-w-[64ch] text-base leading-7 text-gray-300">
          A descriptor is a single JSON document the engine compiles into a finished video — the same source on Node, in
          the browser via WebAssembly, and on-device in React Native. Everything below is generated from the engine's
          own schema, so it never drifts from what compiles.
        </p>
      </div>
    </div>

    <div className="container mx-auto max-w-6xl px-4 py-14">
      <div className="grid gap-12 lg:grid-cols-[1fr_15rem]">
        <div className="min-w-0">
          <DocSection id="overview" title="What it is" kicker="Shape">
            <Prose>
              <p>
                Every descriptor is a single object with two keys: <Code>{'{ global, sections[] }'}</Code>.{' '}
                <Code>global</Code> holds project-wide defaults; <Code>sections</Code> is an ordered list where each
                entry becomes one clip, composed in order. Both keys are optional so partial descriptors validate
                incrementally, but a useful template has at least one section.
              </p>
              <p>
                The descriptor has two layers you can mix freely. The{' '}
                <strong className="text-foreground">structured-sugar</strong> fields — <Code>transition</Code>,{' '}
                <Code>look</Code>, <Code>grade</Code>, <Code>motion</Code>, <Code>audio</Code>, <Code>layers</Code> and{' '}
                <Code>framingGuide</Code> — are high-level intents that compile down to ordinary FFmpeg filters for you.
                Prefer this layer: it is portable, validated, and on-device-safe.
              </p>
              <p>
                When the sugar doesn't cover something, the raw <Code>filters[]</Code> passthrough sends FFmpeg filter
                names and arguments through verbatim — so its keys stay FFmpeg-native (<Code>x</Code>,{' '}
                <Code>fontsize</Code>, <Code>boxcolor</Code>…), while sugar keys use editor-friendly camelCase. Keep the
                two mental models separate.
              </p>
              <p>
                <strong className="text-foreground">All durations are in seconds</strong>, everywhere —{' '}
                <Code>options.duration</Code>, <Code>transition.duration</Code>, <Code>audioFade.in.duration</Code>, and
                the rest.
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
              Re-encoding is the expensive part. In the browser (WASM) and on-device, prefer cuts where you can, and
              keep transition durations short — every cross-fade pays a full decode/encode of the overlapping frames.
            </Callout>
          </DocSection>

          <DocSection id="transitions" title="Transitions" kicker="Live catalogue">
            <Prose className="mb-5">
              <p>
                The <Code>transition.type</Code> on a section (or <Code>global.transition</Code>) is one of the{' '}
                {XFADE_TRANSITIONS.length} xfade names below, or <Code>cut</Code> for a hard boundary. These are grouped
                exactly as the builder's picker groups them.
              </p>
            </Prose>
            <div className="space-y-5">
              {transitionGroups().map((group) => (
                <div key={group.label}>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">{group.label}</h3>
                  <ChipList items={group.names} />
                </div>
              ))}
            </div>
          </DocSection>

          <DocSection id="looks" title="Looks & grade" kicker="Live catalogue">
            <Prose className="mb-5">
              <p>
                <Code>look</Code> applies one of these named colour-grade presets to a section. Layer manual{' '}
                <Code>grade</Code> values (brightness, contrast, saturation…) on top for fine control — see the{' '}
                <a href="#fields" className="text-brand-300 underline-offset-2 hover:underline">
                  field reference
                </a>
                .
              </p>
            </Prose>
            <ChipList items={LOOK_PRESETS} />
          </DocSection>

          <DocSection id="curves" title="Audio fade curves" kicker="Live catalogue">
            <Prose className="mb-5">
              <p>
                A section's <Code>options.audioFade</Code> uses one of FFmpeg's <Code>afade</Code> curve shapes. The
                default is <Code>tri</Code>.
              </p>
            </Prose>
            <ChipList items={AFADE_CURVES} />
          </DocSection>

          <DocSection id="fields" title="Field reference" kicker="Schema-driven">
            <Prose className="mb-6">
              <p>
                Each table is generated by walking the exported JSON Schema — field names, types, ranges and the prose
                meaning all come straight from the engine's zod definitions, so this stays current automatically.
              </p>
            </Prose>
            <div className="space-y-9">
              {groups.map((group) => (
                <div key={group.id} id={group.id} className="scroll-mt-28">
                  <h3 className="mb-1 font-mono text-base font-semibold text-foreground">{group.title}</h3>
                  <p className="mb-3 max-w-[64ch] text-sm text-gray-400">{group.summary}</p>
                  <FieldTable rows={group.rows} />
                </div>
              ))}
            </div>
          </DocSection>

          <DocSection id="examples" title="Example descriptors" kicker="Copy-paste">
            <div className="space-y-8">
              {examples.map((example) => (
                <div key={example.id} id={example.id} className="scroll-mt-28">
                  <h3 className="mb-1 text-lg font-semibold text-foreground">{example.title}</h3>
                  <p className="mb-3 max-w-[64ch] text-sm text-gray-400">{example.blurb}</p>
                  <JsonBlock code={example.json} />
                </div>
              ))}
            </div>
          </DocSection>

          <DocSection id="schema" title="Raw JSON Schema" kicker="Machine-readable">
            <Prose className="mb-5">
              <p>
                The full generated schema, for tooling and validation. The same object is exported from the core package
                as <Code>templateDescriptorJsonSchema</Code>.
              </p>
            </Prose>
            <RawSchema />
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={`${REPO}/blob/main/docs/template-configuration.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-divider bg-surface-2 px-4 py-2 text-sm text-foreground transition-colors hover:border-brand-400"
              >
                <BookOpen className="h-4 w-4" /> Full prose reference
              </a>
              <a
                href={`${REPO}/blob/main/docs/template-descriptor.schema.json`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-divider bg-surface-2 px-4 py-2 text-sm text-foreground transition-colors hover:border-brand-400"
              >
                <Code2 className="h-4 w-4" /> Schema on GitHub
              </a>
            </div>
          </DocSection>
        </div>

        <TableOfContents />
      </div>
    </div>
  </div>
);
