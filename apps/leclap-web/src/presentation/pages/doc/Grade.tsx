import { Seo } from '@/presentation/components/Seo';
import { DocSection, Prose, Code, RefTable, Sample } from '@/presentation/components/doc/DocBlocks';
import { docGroups } from '@/presentation/components/doc/schemaFields';
import { snippets } from '@/presentation/components/doc/snippets';
import { DocPageHeader } from './DocLayout';

export const DocGrade = () => (
  <>
    <Seo
      title="Colour grade — template descriptor"
      description="The manual colour-grade controls — brightness, contrast, saturation, gamma, hue, per-range colour balance, blur and curves — layered on top of any look."
      path="/doc/grade"
    />

    <DocPageHeader kicker="Schema-driven" title="Colour grade">
      <Code>grade</Code> gives per-section manual control over colour. It applies on top of any named <Code>look</Code>,
      so reach for it when a preset is close but not exact, or when you want a bespoke treatment from scratch.
    </DocPageHeader>

    <DocSection id="reference" title="Fields" kicker="grade">
      <Prose className="mb-5">
        <p>
          <Code>colorBalance</Code> nests per-range red/green/blue offsets (<Code>shadows</Code>, <Code>midtones</Code>,{' '}
          <Code>highlights</Code>); the rest are scalar adjustments compiled into the FFmpeg filter chain.
        </p>
      </Prose>
      <RefTable
        id="grade"
        title="grade"
        summary="Manual colour grade, applied on top of any named look."
        rows={docGroups.grade()}
      />
      <Sample code={snippets.grade} title="Look + manual grade" />
    </DocSection>
  </>
);
