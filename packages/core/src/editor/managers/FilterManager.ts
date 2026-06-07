import { inject, injectable } from 'tsyringe';
import type Template from '../../core/models/Template';
import type Segment from '../../core/models/Segment';
import type { Filter } from '@/core/types';
import type FormatterManager from './FormatterManager';

@injectable()
class FilterManager {
  constructor(
    @inject('template') private readonly template: Template,
    @inject('FormattersManager') protected readonly formattersManager: FormatterManager,
    @inject('segment') public segment: Segment
  ) {}

  addFilter = (filter: Filter): string => {
    let resolvedFilter = filter;

    // Manage suffixes on filter
    if (resolvedFilter.range) {
      resolvedFilter = this.remapEnableBetweenSuffix(resolvedFilter);
    }

    // Remap custom types
    if (['fadein', 'fadeout'].includes(resolvedFilter.type)) {
      resolvedFilter = this.remapFadeTypeShortcuts(resolvedFilter);
    }

    if (resolvedFilter.value) {
      // Process single value filter
      return this.formattersManager.formatMultipleTypesValue(resolvedFilter);
    }

    if (resolvedFilter.values) {
      // Process multiples values filter
      return this.formattersManager.formatMultipleTypesValues(resolvedFilter);
    }

    return resolvedFilter.type;
  };

  remapEnableBetweenSuffix = (filter: Filter): Filter => {
    if (!filter.range) {
      return filter;
    }

    const durations = filter.range.split(':');

    if (durations.length < 2) {
      return filter;
    }

    let end = this.template.descriptor.global?.transitionDuration ?? 0;
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
