import { Seo } from '@/presentation/components/Seo';
import { Code, DocSection, DocSubsection, JsonBlock } from '@/presentation/components/doc/DocBlocks';
import { examples } from '@/presentation/components/doc/examples';
import { DocPageHeader } from './DocLayout';

export const DocExamples = () => (
  <>
    <Seo
      title="Examples — template descriptor"
      description="Copy-paste LeClap template descriptors you can save as JSON and render with the CLI."
      path="/doc/examples"
    />

    <DocPageHeader kicker="Copy-paste" title="Example descriptors">
      Complete, runnable descriptors. Save any one as a <Code>.json</Code> file and render it with{' '}
      <Code>leclap render</Code>.
    </DocPageHeader>

    <DocSection id="examples" title="Examples" kicker={`${examples.length} templates`}>
      <div className="space-y-12">
        {examples.map((example) => (
          <DocSubsection key={example.id} id={example.id} title={example.title}>
            <p className="mb-4 max-w-[33rem] text-sm leading-6 text-gray-400">{example.blurb}</p>
            <JsonBlock code={example.json} />
          </DocSubsection>
        ))}
      </div>
    </DocSection>
  </>
);
