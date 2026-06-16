import { Seo } from '@/presentation/components/Seo';
import { DocSection, Prose, Code, Callout, RefTable, Sample } from '@/presentation/components/doc/DocBlocks';
import { docGroups } from '@/presentation/components/doc/schemaFields';
import { snippets } from '@/presentation/components/doc/snippets';
import { DocPageHeader } from './DocLayout';

export const DocFilters = () => (
  <>
    <Seo
      title="Filters & maps — template descriptor"
      description="The raw FFmpeg escape hatch: pass filter names and arguments through verbatim, and wire explicit filtergraph maps for full control."
      path="/doc/filters"
    />

    <DocPageHeader kicker="Power user" title="Filters & maps">
      When the structured sugar doesn't cover something, drop to the raw layer. <Code>filters[]</Code> sends FFmpeg
      filters through verbatim, and <Code>maps[]</Code> wires explicit filtergraph inputs and outputs.
    </DocPageHeader>

    <Callout label="Prefer sugar" className="mb-12">
      The raw layer is FFmpeg-native and not guaranteed portable — some filters are unavailable in the WebAssembly and
      on-device builds. Reach for <Code>transition</Code>, <Code>look</Code>, <Code>grade</Code>, <Code>motion</Code>,{' '}
      <Code>caption</Code> and <Code>layers</Code> first; use <Code>filters[]</Code> only for what they can't express.
    </Callout>

    <DocSection id="filters" title="Raw filters" kicker="filters[]">
      <Prose className="mb-5">
        <p>
          Each entry names a filter (<Code>type</Code>) and carries its arguments under <Code>values</Code> — whose keys
          stay FFmpeg-native (<Code>x</Code>, <Code>fontsize</Code>, <Code>boxcolor</Code>…), not camelCase. An optional{' '}
          <Code>range</Code> gates when the filter is active.
        </p>
      </Prose>
      <div className="space-y-9">
        <RefTable
          id="filter"
          title="filters[]"
          summary="One raw FFmpeg filter applied to the section."
          rows={docGroups.filters()}
        />
        <RefTable
          id="filter-values"
          title="filters[].values"
          summary="FFmpeg-native arguments passed straight to the filter."
          rows={docGroups.filterValues()}
        />
      </div>
      <Sample code={snippets.filters} title="A raw drawtext filter" />
    </DocSection>

    <DocSection id="maps" title="Filtergraph maps" kicker="maps[]">
      <Prose className="mb-5">
        <p>
          <Code>maps[]</Code> gives explicit control over the filtergraph — naming <Code>inputs</Code> and{' '}
          <Code>outputs</Code> so you can route and combine streams that the sugar composes automatically.
        </p>
      </Prose>
      <RefTable
        id="map"
        title="maps[]"
        summary="Explicit filtergraph wiring: inputs, outputs, filters, and options."
        rows={docGroups.maps()}
      />
      <Sample code={snippets.maps} title="An explicit filtergraph map" />
    </DocSection>
  </>
);
