import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '@/presentation/components/ui';
import type { ComplexityFacet, OrientationFacet } from '@/lib/filterTemplates';

interface TemplateSearchBarProps {
  query: string;
  orientation: OrientationFacet;
  complexity: ComplexityFacet;
  onQuery: (query: string) => void;
  onOrientation: (orientation: OrientationFacet) => void;
  onComplexity: (complexity: ComplexityFacet) => void;
}

export const TemplateSearchBar = ({
  query,
  orientation,
  complexity,
  onQuery,
  onOrientation,
  onComplexity,
}: TemplateSearchBarProps) => {
  const { t } = useTranslation('templates');

  return (
    <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative w-full lg:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            onQuery(event.target.value);
          }}
          placeholder={t('search.placeholder')}
          aria-label={t('search.placeholder')}
          className="w-full rounded-lg border border-divider bg-surface-2 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-gray-500 transition-all focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <SegmentedControl
          value={orientation}
          onChange={(value) => {
            onOrientation(value as OrientationFacet);
          }}
          options={[
            { value: 'all', label: t('search.all') },
            { value: 'portrait', label: t('search.portrait') },
            { value: 'landscape', label: t('search.landscape') },
          ]}
        />
        <SegmentedControl
          value={complexity}
          onChange={(value) => {
            onComplexity(value as ComplexityFacet);
          }}
          options={[
            { value: 'all', label: t('search.all') },
            { value: 'simple', label: t('complexity.simple') },
            { value: 'intermediate', label: t('complexity.intermediate') },
            { value: 'advanced', label: t('complexity.advanced') },
          ]}
        />
      </div>
    </div>
  );
};
