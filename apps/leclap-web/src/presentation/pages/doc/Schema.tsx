import { useState } from 'react';
import { BookOpen, Code2, ChevronDown } from 'lucide-react';
import { templateDescriptorJsonSchema } from 'ffmpeg-video-composer/src/schemas/template.schemas.ts';
import { Seo } from '@/presentation/components/Seo';
import { DocSection, Prose, Code, JsonBlock } from '@/presentation/components/doc/DocBlocks';
import { DocPageHeader } from './DocLayout';

const REPO = 'https://github.com/heristop/leclap';

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

export const DocSchema = () => (
  <>
    <Seo
      title="JSON Schema — template descriptor"
      description="The full machine-readable JSON Schema for the LeClap template descriptor, for editor tooling and validation."
      path="/doc/schema"
    />

    <DocPageHeader kicker="Machine-readable" title="Raw JSON Schema">
      The complete generated schema, for editor autocompletion and validation. The same object is exported from the core
      package as <Code>templateDescriptorJsonSchema</Code>, so your tooling and these docs share one source.
    </DocPageHeader>

    <DocSection id="schema" title="Generated schema" kicker="Validation">
      <Prose className="mb-5">
        <p>Expand to read the full schema, or grab it from the repo for use in your own tooling.</p>
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
  </>
);
