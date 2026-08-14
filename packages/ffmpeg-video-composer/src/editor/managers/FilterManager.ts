import { inject, injectable } from 'tsyringe';
import type Template from '../../core/models/Template';
import type Segment from '../../core/models/Segment';
import type Project from '../../core/models/Project';
import type { Filter } from '@/core/types';
import type AbstractLogger from '../../platform/logging/AbstractLogger';
import { applyFilterCompat, engineCapabilities } from '../utils/filter-compat';
import { applyAnimation } from '../presets/text';
import type FormatterManager from './FormatterManager';

// A drawtext base coordinate may be authored as a number or an expression string; anything else
// (absent, malformed) falls back to the frame origin.
function baseCoordinate(value: unknown): string | number {
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }

  return '0';
}

@injectable()
class FilterManager {
  constructor(
    @inject('template') private readonly template: Template,
    @inject('FormattersManager') protected readonly formattersManager: FormatterManager,
    @inject('segment') public segment: Segment,
    @inject('project') private readonly project: Project,
    @inject('logger') private readonly logger: AbstractLogger
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
    // engine lacks GPL `eq` → lutyuv). A null result means the filter has no equivalent here: degrade
    // to the no-op `null` filter and warn, rather than emitting a filter the engine will die on.
    const compat = applyFilterCompat(resolvedFilter, engineCapabilities(this.project.config));

    if (compat === null) {
      this.logger.warn(`[FilterCompat] dropped unavailable filter "${resolvedFilter.type}"`);

      // `null` is the video no-op passthrough (device-enabled — see common.sh / ENGINE_EMITTED_FILTERS).
      // A future AUDIO drop rule must return the audio equivalent 'anull' instead — 'null' only
      // passthroughs a video stream.
      return 'null';
    }

    resolvedFilter = compat;

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
    // The schema allows numeric x/y as well as expression strings; both are valid base positions.
    // Coercing a number to '0' would anchor the animation to the frame origin.
    const base = { x: baseCoordinate(values.x), y: baseCoordinate(values.y) };
    applyAnimation(values, filter.reveal, filter.exit, base, duration);

    return { ...filter, values };
  };

  remapEnableBetweenSuffix = (filter: Filter): Filter => {
    if (!filter.range) {
      return filter;
    }

    const durations = filter.range.split(':');

    if (durations.length < 2) {
      return filter;
    }

    // `{{ section_duration }}` is substituted BEFORE parsing: parseFloat on the raw token yields
    // NaN, which used to slip past the undefined checks and emit between(t,…,NaN) — an enable
    // expression that is never true, silently disabling the filter for the whole section.
    const sectionDuration = this.segment.currentSection?.options?.duration ?? 0;

    function extractTimeValue(pattern: RegExp, duration: string): number | undefined {
      const matches = pattern.exec(duration);

      if (!matches) {
        return undefined;
      }

      const parsed = parseFloat(matches[1].replace('{{ section_duration }}', sectionDuration.toString()));

      return Number.isFinite(parsed) ? parsed : undefined;
    }

    let end = this.template.descriptor.global?.transition?.duration ?? 0;
    let start = 0;

    const startTime = extractTimeValue(/start=(.*)/, durations[0]);

    if (undefined !== startTime) {
      start = startTime;

      const endTime = extractTimeValue(/end=(.*)/, durations[1]);

      if (undefined !== endTime) {
        end = endTime;
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
