import { Search } from '@/presentation/components/icons';
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

// A mini viewfinder drawn in the option's real aspect ratio, so the orientation reads as a shape rather
// than a long word. `border-current` inherits the button's active/inactive text color automatically.
const FRAME_SIZE = { portrait: 'h-4 w-2.5', landscape: 'h-2.5 w-4', square: 'h-3.5 w-3.5' } as const;

const FrameIcon = ({ shape }: { shape: keyof typeof FRAME_SIZE }) => (
  <span className="flex h-5 items-center justify-center">
    <span className={`rounded-[2px] border-[1.5px] border-current ${FRAME_SIZE[shape]}`} />
  </span>
);

// A staircase whose visible step count IS the complexity level (1 simple, 2 intermediate, 3 advanced).
// Showing only as many bars as the level — not three with some dimmed — makes the level legible at a
// glance; the hover tooltip / aria-label carries the exact word.
const STEP_HEIGHTS = ['h-1.5', 'h-2.5', 'h-3.5'];

const LevelIcon = ({ level }: { level: 1 | 2 | 3 }) => (
  <span className="flex h-5 w-7 items-end justify-center gap-0.5 pb-0.5">
    {STEP_HEIGHTS.slice(0, level).map((height) => (
      <span key={height} className={`w-1.5 rounded-[1px] bg-current ${height}`} />
    ))}
  </span>
);

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
      <div className="focus-gradient-ring relative w-full rounded-lg lg:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            onQuery(event.target.value);
          }}
          placeholder={t('search.placeholder')}
          aria-label={t('search.placeholder')}
          className="w-full rounded-lg border border-divider bg-surface-2 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-gray-500 transition-colors focus-visible:border-transparent focus-visible:outline-none"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <SegmentedControl
          ariaLabel={t('search.orientationLabel')}
          value={orientation}
          onChange={(value) => {
            onOrientation(value as OrientationFacet);
          }}
          options={[
            { value: 'all', label: t('search.all') },
            { value: 'portrait', label: <FrameIcon shape="portrait" />, ariaLabel: t('search.portrait') },
            { value: 'landscape', label: <FrameIcon shape="landscape" />, ariaLabel: t('search.landscape') },
            { value: 'square', label: <FrameIcon shape="square" />, ariaLabel: t('search.square') },
          ]}
        />
        <SegmentedControl
          ariaLabel={t('search.complexityLabel')}
          value={complexity}
          onChange={(value) => {
            onComplexity(value as ComplexityFacet);
          }}
          options={[
            { value: 'all', label: t('search.all') },
            { value: 'simple', label: <LevelIcon level={1} />, ariaLabel: t('complexity.simple') },
            { value: 'intermediate', label: <LevelIcon level={2} />, ariaLabel: t('complexity.intermediate') },
            { value: 'advanced', label: <LevelIcon level={3} />, ariaLabel: t('complexity.advanced') },
          ]}
        />
      </div>
    </div>
  );
};
