import { LOOK_PRESETS } from 'ffmpeg-video-composer/src/schemas/template.schemas.ts';
import { Seo } from '@/presentation/components/Seo';
import { DocSection, Prose, Code, ChipList, Tip, Sample } from '@/presentation/components/doc/DocBlocks';
import { snippets } from '@/presentation/components/doc/snippets';
import { DocPageHeader } from './DocLayout';

export const DocLooks = () => (
  <>
    <Seo
      title="Looks — template descriptor"
      description="The named colour-grade presets a LeClap section can apply via the look field, and how they combine with a manual grade."
      path="/doc/looks"
    />

    <DocPageHeader kicker="Live catalogue" title="Looks">
      A section's <Code>look</Code> applies one of these named colour-grade presets in a single step. It's a
      base-section field — set it on any section type.
    </DocPageHeader>

    <DocSection id="presets" title="Presets" kicker={`${LOOK_PRESETS.length} looks`}>
      <Prose className="mb-5">
        <p>
          Each preset is a curated combination of brightness, contrast, saturation and tone. Pick one as a starting
          point, then refine with manual <Code>grade</Code> values — see{' '}
          <a
            className="font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-300"
            href="/doc/grade"
          >
            colour grade
          </a>
          .
        </p>
      </Prose>
      <ChipList items={LOOK_PRESETS} />
      <Prose className="mt-5">
        <p>
          The first group (<Code>cinematic</Code>, <Code>warm</Code>, <Code>cool</Code>, <Code>vintage</Code>,{' '}
          <Code>noir</Code>, <Code>vivid</Code>, <Code>dreamy</Code>) are <Code>eq</Code>/<Code>curves</Code> stacks. The{' '}
          <Code>-film</Code> / <Code>-pop</Code> looks (<Code>teal-orange</Code>, <Code>warm-film</Code>,{' '}
          <Code>mono-film</Code>, <Code>noir-film</Code>, <Code>vivid-pop</Code>) are <strong>LUT-backed</strong> — a
          single <Code>lut3d</Code> with a bundled <Code>.cube</Code> file, a stronger and cleaner grade. They run on
          every backend; a backend without <Code>lut3d</Code> drops the look with a warning rather than failing the
          render.
        </p>
      </Prose>
      <Sample code={snippets.look} title="Applying a look" />
      <Tip className="mt-6">
        Start from a <Code>look</Code> preset, then nudge with manual <Code>grade</Code> values — they layer on top of
        the preset, so you keep its character while dialling brightness or saturation to taste.
      </Tip>
    </DocSection>
  </>
);
