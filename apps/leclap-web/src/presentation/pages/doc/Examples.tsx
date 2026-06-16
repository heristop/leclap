import { Seo } from '@/presentation/components/Seo';
import { DocSection, JsonBlock } from '@/presentation/components/doc/DocBlocks';
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
      Complete, runnable descriptors. Save any one as a <code className="font-mono text-[0.9em]">.json</code> file and
      render it with <code className="font-mono text-[0.9em]">leclap render</code>.
    </DocPageHeader>

    <DocSection id="examples" title="Examples" kicker={`${examples.length} templates`}>
      <div className="space-y-8">
        {examples.map((example) => (
          <div key={example.id} id={example.id} className="scroll-mt-28">
            <h3 className="mb-1 text-lg font-semibold text-foreground">{example.title}</h3>
            <p className="mb-3 max-w-[68ch] text-sm text-gray-400">{example.blurb}</p>
            <JsonBlock code={example.json} />
          </div>
        ))}
      </div>
    </DocSection>
  </>
);
