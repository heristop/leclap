import { Seo } from '@/presentation/components/Seo';
import { DocSection, Prose, Code, Tip, RefTable, Sample } from '@/presentation/components/doc/DocBlocks';
import { docGroups, sectionTypeValues } from '@/presentation/components/doc/schemaFields';
import { snippets } from '@/presentation/components/doc/snippets';
import { DocPageHeader } from './DocLayout';

// The discriminated-union `type` set is schema-driven (sectionTypeValues); these one-line glosses are
// the only hand-authored part. A type added to the schema shows here with an em-dash, flagging it for
// a blurb rather than silently disappearing.
const TYPE_BLURB: Record<string, string> = {
  video: 'A bundled or uploaded video clip.',
  project_video: 'A clip the end user records or supplies at build time — pair with a framingGuide to guide the shot.',
  form: 'A data-collection step whose fields feed later text. Produces no clip of its own.',
  color_background: 'A solid-colour or gradient backdrop, optionally with composited layers.',
  image_background: 'A still-image backdrop.',
  music: 'A music-only section contributing audio to the final mix.',
  partial: 'Embeds a reusable partial template, optionally with a prefix and overridden variables.',
};

export const DocSections = () => (
  <>
    <Seo
      title="Sections & types — template descriptor"
      description="The seven LeClap section types, the base fields every section shares, and the full per-section options surface."
      path="/doc/sections"
    />

    <DocPageHeader kicker="Structure" title="Sections & types">
      <Code>sections</Code> is an ordered list; each entry becomes one clip, composed top to bottom. Every section
      shares a common base, then a <Code>type</Code> selects which extra <Code>options</Code> apply.
    </DocPageHeader>

    <DocSection id="types" title="Section types" kicker="Discriminated union">
      <Prose className="mb-5">
        <p>
          The <Code>type</Code> field is the discriminant. There are {sectionTypeValues().length} types — each unlocks
          its own <Code>options</Code> (for example <Code>layers</Code> on <Code>color_background</Code>,{' '}
          <Code>framingGuide</Code> on <Code>project_video</Code>, <Code>fields</Code> on <Code>form</Code>).
        </p>
      </Prose>
      <div className="overflow-x-auto rounded-2xl border border-divider bg-surface/60">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-divider bg-foreground/[0.025] text-[0.7rem] uppercase tracking-wider text-gray-500">
              <th className="px-4 py-3 font-semibold">type</th>
              <th className="px-4 py-3 font-semibold">Use</th>
            </tr>
          </thead>
          <tbody>
            {sectionTypeValues().map((type) => (
              <tr key={type} className="border-b border-divider/60 align-top last:border-0">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-[0.85rem] font-medium text-foreground">
                  {type}
                </td>
                <td className="px-4 py-3 text-[0.85rem] leading-6 text-gray-300">{TYPE_BLURB[type] ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DocSection>

    <DocSection id="reference" title="Fields" kicker="Schema-driven">
      <div className="space-y-9">
        <RefTable
          id="section"
          title="section"
          summary="The base fields every section shares, whatever its type."
          rows={docGroups.section()}
        />
        <RefTable
          id="options"
          title="options"
          summary="Per-section knobs, unioned across every section type — duration, speed, framing, fades, colours, layers and more. Which keys are valid depends on the section type."
          rows={docGroups.options()}
        />
        <RefTable
          id="inputs"
          title="inputs[]"
          summary="Animation assets composited over the section video."
          rows={docGroups.inputs()}
        />
      </div>
      <Sample code={snippets.section} title="A minimal section" />
      <Tip className="mt-8">
        Only the fields tagged <span className="font-semibold text-foreground">required</span> must be present —
        everything else falls back to a schema default, so a minimal section is often just a <Code>type</Code> and its{' '}
        <Code>options</Code>. Omit what you don't need and add fields as you go.
      </Tip>
    </DocSection>
  </>
);
