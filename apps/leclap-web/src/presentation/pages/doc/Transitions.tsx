import { XFADE_TRANSITIONS } from 'ffmpeg-video-composer/src/schemas/template.schemas.ts';
import { transitionGroups } from '@/presentation/components/admin/editor/transitionGroups';
import { Seo } from '@/presentation/components/Seo';
import { DocSection, Code, ChipList, Tip, RefTable, Sample } from '@/presentation/components/doc/DocBlocks';
import { docGroups } from '@/presentation/components/doc/schemaFields';
import { snippets } from '@/presentation/components/doc/snippets';
import { DocPageHeader } from './DocLayout';

export const DocTransitions = () => (
  <>
    <Seo
      title="Transitions — template descriptor"
      description="The full live catalogue of LeClap transition types — every xfade name plus cut — and the transition field reference."
      path="/doc/transitions"
    />

    <DocPageHeader kicker="Live catalogue" title="Transitions">
      The <Code>transition.type</Code> on a section (or <Code>global.transition</Code> as the default) is one of the{' '}
      {XFADE_TRANSITIONS.length} xfade names below, or <Code>cut</Code> for a hard boundary. They're grouped exactly as
      the builder's picker groups them.
    </DocPageHeader>

    <DocSection id="catalogue" title="Every transition" kicker={`${XFADE_TRANSITIONS.length + 1} options`}>
      <div className="space-y-5">
        {transitionGroups().map((group) => (
          <div key={group.label}>
            <h3 className="mb-2 text-sm font-semibold text-foreground">{group.label}</h3>
            <ChipList items={group.names} />
          </div>
        ))}
      </div>
      <Tip className="mt-6">
        Set <Code>global.transition</Code> once as the project default, then add a per-section <Code>transition</Code>{' '}
        only where you want a different boundary. Sections without one inherit the global value — and <Code>cut</Code>{' '}
        always wins back the fast no-re-encode path.
      </Tip>
    </DocSection>

    <DocSection id="reference" title="Fields" kicker="Schema-driven">
      <RefTable
        id="transition"
        title="transition"
        summary="The boundary effect carrying one section into the next."
        rows={docGroups.transition()}
      />
      <Sample code={snippets.transition} title="Default transition + per-section override" />
    </DocSection>
  </>
);
