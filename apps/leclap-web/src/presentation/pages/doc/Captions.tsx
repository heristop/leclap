import {
  CAPTION_STYLES,
  CAPTION_POSITIONS,
  CAPTION_ALIGNS,
} from 'ffmpeg-video-composer/src/schemas/template.schemas.ts';
import { Seo } from '@/presentation/components/Seo';
import { DocSection, Prose, Code, ChipList, RefTable, Sample } from '@/presentation/components/doc/DocBlocks';
import { docGroups } from '@/presentation/components/doc/schemaFields';
import { snippets } from '@/presentation/components/doc/snippets';
import { DocPageHeader } from './DocLayout';

export const DocCaptions = () => (
  <>
    <Seo
      title="Captions — template descriptor"
      description="The caption sugar — localized text drawn over a section — and its style, position and alignment options."
      path="/doc/captions"
    />

    <DocPageHeader kicker="Schema-driven" title="Captions">
      <Code>caption</Code> draws styled, localized text over a section without hand-writing a <Code>drawtext</Code>{' '}
      filter. Set the text and pick a style, position and alignment.
    </DocPageHeader>

    <DocSection id="reference" title="Fields" kicker="caption">
      <RefTable
        id="caption"
        title="caption"
        summary="Styled text overlaid on the section, with translation-aware text."
        rows={docGroups.caption()}
      />
      <Sample code={snippets.caption} title="A captioned section" />
    </DocSection>

    <DocSection id="enums" title="Style, position & alignment" kicker="Enums">
      <Prose className="mb-5">
        <p>
          <Code>style</Code> picks the visual preset, <Code>position</Code> places the caption vertically, and{' '}
          <Code>align</Code> sets horizontal alignment. Defaults are <Code>bar</Code>, <Code>bottom</Code> and{' '}
          <Code>center</Code>.
        </p>
      </Prose>
      <div className="space-y-5">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">style</h3>
          <ChipList items={CAPTION_STYLES} />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">position</h3>
          <ChipList items={CAPTION_POSITIONS} />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">align</h3>
          <ChipList items={CAPTION_ALIGNS} />
        </div>
      </div>
    </DocSection>
  </>
);
