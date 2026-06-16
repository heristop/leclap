import { Seo } from '@/presentation/components/Seo';
import { DocSection, Prose, Code, RefTable, Sample } from '@/presentation/components/doc/DocBlocks';
import { docGroups } from '@/presentation/components/doc/schemaFields';
import { snippets } from '@/presentation/components/doc/snippets';
import { DocPageHeader } from './DocLayout';

export const DocMotion = () => (
  <>
    <Seo
      title="Motion & layers — template descriptor"
      description="Per-section motion effects (Ken Burns, rotate, crop, flip), the recording framing guide, and composited background layers."
      path="/doc/motion"
    />

    <DocPageHeader kicker="Schema-driven" title="Motion & layers">
      Movement and compositing sugar: animate a section with <Code>motion[]</Code>, guide a recording with{' '}
      <Code>framingGuide</Code>, and stack solid or gradient <Code>layers[]</Code> over a background.
    </DocPageHeader>

    <DocSection id="motion" title="Motion effects" kicker="motion[]">
      <Prose className="mb-5">
        <p>
          <Code>motion</Code> is an ordered array of effects applied in sequence. It's a discriminated union — each
          effect carries the fields for its kind (Ken Burns, rotate, crop, flip); the table below merges every variant's
          fields.
        </p>
      </Prose>
      <RefTable
        id="motion-fields"
        title="motion[]"
        summary="Per-section motion and geometric effects (Ken Burns, rotate, crop, flip), applied in order."
        rows={docGroups.motion()}
      />
      <Sample code={snippets.motion} title="Stacking motion effects" />
    </DocSection>

    <DocSection id="framing-guide" title="Framing guide" kicker="project_video">
      <Prose className="mb-5">
        <p>
          <Code>framingGuide</Code> draws a silhouette overlay while the user records a <Code>project_video</Code> clip,
          so the subject lines up with the composition. It's a recording aid — it isn't burned into the output.
        </p>
      </Prose>
      <RefTable
        id="framing-guide-fields"
        title="framingGuide"
        summary="The silhouette overlay shown while recording a clip."
        rows={docGroups.framingGuide()}
      />
      <Sample code={snippets.framingGuide} title="A project_video with a framing guide" />
    </DocSection>

    <DocSection id="layers" title="Background layers" kicker="color_background">
      <Prose className="mb-5">
        <p>
          <Code>layers[]</Code> composites solid or gradient panels over a <Code>color_background</Code> section —
          useful for tints, vignettes, and gradient washes behind text.
        </p>
      </Prose>
      <RefTable
        id="layers-fields"
        title="layers[]"
        summary="Background layers (solid or gradient) composited over a color_background section."
        rows={docGroups.layers()}
      />
      <Sample code={snippets.layers} title="Solid + gradient layers" />
    </DocSection>
  </>
);
