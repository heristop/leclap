import { useLayoutEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { ComplexityFacet, OrientationFacet } from '@/lib/filterTemplates';

interface SegmentedProps {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

// Padding (px) of the track — the thumb sits inside it, so offsets are measured from the padding edge.
const TRACK_PAD = 2;

// A single sliding thumb that glides between options ("magnetic" feel) instead of the active
// background snapping. Position + width are measured from the active button and animated via
// transform/width, with a reduced-motion fallback that snaps.
const Segmented = ({ value, options, onChange }: SegmentedProps) => {
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );

  useLayoutEffect(() => {
    const measure = () => {
      const el = buttonsRef.current[activeIndex];

      if (!el) return;

      const next = { left: el.offsetLeft, width: el.offsetWidth };
      setThumb((prev) => (prev && prev.left === next.left && prev.width === next.width ? prev : next));
    };

    measure();
    const observer = new ResizeObserver(measure);

    for (const el of buttonsRef.current) {
      if (el) observer.observe(el);
    }

    return () => {
      observer.disconnect();
    };
  }, [activeIndex, options]);

  return (
    <div className="relative inline-flex rounded-lg bg-foreground/5 p-0.5 text-sm">
      {thumb && (
        <span
          aria-hidden
          className="absolute bottom-0.5 left-0 top-0.5 rounded-md bg-surface shadow-sm transition-[transform,width] duration-300 ease-[var(--ease-out-expo)] motion-reduce:transition-none"
          style={{ transform: `translateX(${thumb.left - TRACK_PAD}px)`, width: thumb.width }}
        />
      )}
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(el) => {
            buttonsRef.current[index] = el;
          }}
          type="button"
          onClick={() => {
            onChange(option.value);
          }}
          className={cn(
            'tap relative z-10 rounded-md px-3 py-1.5 font-medium transition-colors',
            value === option.value ? 'text-foreground' : 'text-gray-400 hover:text-foreground'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

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
        <Segmented
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
        <Segmented
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
