import { inject, injectable } from 'tsyringe';
import type Template from '../../core/models/Template';
import type Segment from '../../core/models/Segment';
import type Project from '../../core/models/Project';
import type { Filter } from '@/core/types';
import { applyFilterCompat, engineCapabilities } from '../filter-compat';
import { applyAnimation } from '../presets/text';
import type FormatterManager from './FormatterManager';

@injectable()
class FilterManager {
  constructor(
    @inject('template') private readonly template: Template,
    @inject('FormattersManager') protected readonly formattersManager: FormatterManager,
    @inject('segment') public segment: Segment,
    @inject('project') private readonly project: Project
  ) {}

  addFilter = (filter: Filter): string => {
    let resolvedFilter = filter;

    if (resolvedFilter.range) {
      resolvedFilter = this.remapEnableBetweenSuffix(resolvedFilter);
    }

    if (['fadein', 'fadeout'].includes(resolvedFilter.type)) {
      resolvedFilter = this.remapFadeTypeShortcuts(resolvedFilter);
    }

    resolvedFilter = this.bakeTextAnimation(resolvedFilter);

    // Platform filter-compat: rewrite filters the active engine can't run (e.g. the on-device LGPL
    // engine lacks GPL `eq` → lutyuv). A null result would mean "drop", which no current rule does.
    resolvedFilter = applyFilterCompat(resolvedFilter, engineCapabilities(this.project.config)) ?? resolvedFilter;

    if (resolvedFilter.value) {
      return this.formattersManager.formatMultipleTypesValue(resolvedFilter);
    }

    if (resolvedFilter.values) {
      return this.formattersManager.formatMultipleTypesValues(resolvedFilter);
    }

    return resolvedFilter.type;
  };

  // Animated entrance/exit: a drawtext with a `reveal` and/or `exit` gets alpha + kinetic x/y baked
  // from its base x/y (the same vocabulary as the caption/lowerThird sugar), so positioned text
  // overlays animate in and out. The exit is timed against the section duration.
  private readonly bakeTextAnimation = (filter: Filter): Filter => {
    if (filter.type !== 'drawtext' || (!filter.reveal && !filter.exit) || !filter.values) {
      return filter;
    }

    const values = { ...filter.values } as Record<string, unknown>;
    const duration = this.segment.currentSection?.options?.duration ?? 0;
    const base = { x: typeof values.x === 'string' ? values.x : '0', y: typeof values.y === 'string' ? values.y : '0' };
    applyAnimation(values, filter.reveal, filter.exit, base, duration);

    return { ...filter, values: values as Filter['values'] };
  };

  remapEnableBetweenSuffix = (filter: Filter): Filter => {
    if (!filter.range) {
      return filter;
    }

    const durations = filter.range.split(':');

    if (durations.length < 2) {
      return filter;
    }

    let end = this.template.descriptor.global?.transition?.duration ?? 0;
    let start = 0;

    const extractTimeValue = (pattern: RegExp, duration: string): number | undefined => {
      const matches = pattern.exec(duration);

      return matches ? parseFloat(matches[1]) : undefined;
    };

    const startTime = extractTimeValue(/start=(.*)/, durations[0]);

    if (undefined !== startTime) {
      start = startTime;

      const endTime = extractTimeValue(/end=(.*)/, durations[1]);

      if (undefined !== endTime) {
        const time = this.segment.currentSection?.options?.duration;
        end = parseFloat(endTime.toString().replace('{{ section_duration }}', (time ?? 0).toString()));
      }
    }

    filter.value = `${filter.value}:enable='between(t,${start},${end})'`;

    return filter;
  };

  remapFadeTypeShortcuts = (filter: Filter): Filter => {
    switch (filter.type) {
      case 'fadein':
        filter.type = 'fade';

        filter.values ??= {};

        filter.values = {
          t: 'in',
          d: '{{ transitionDuration }}',
          ...filter.values,
        };
        break;
      case 'fadeout':
        filter.type = 'fade';

        filter.values ??= {};

        filter.values = {
          t: 'out',
          d: '{{ transitionDuration }}',
          st: '{{ transitionStartTime }}',
          ...filter.values,
        };
        break;
      default:
        break;
    }

    return filter;
  };
}

export default FilterManager;
