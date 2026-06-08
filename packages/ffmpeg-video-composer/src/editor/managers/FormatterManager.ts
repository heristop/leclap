import { inject, injectable } from 'tsyringe';
import type AbstractLogger from '../../platform/logging/AbstractLogger';
import type Template from '../../core/models/Template';
import type Segment from '../../core/models/Segment';
import type Project from '../../core/models/Project';
import type { Filter, FilterValues } from '@/core/types';
import type VariableManager from './VariableManager';

// Reserved FFmpeg drawtext characters and their escaped replacements.
const TEXT_ESCAPES: Record<string, string> = {
  ':': '\\\u003A',
  "'": '\u2019',
  '%': '\\\\\\\u0025',
};

// Extended filter values allowing runtime keys not captured in the core type.
type ExtendedFilterValues = FilterValues & Record<string, string | number | undefined>;

@injectable()
class FormatterManager {
  constructor(
    @inject('project') private readonly project: Project,
    @inject('template') private readonly template: Template,
    @inject('VariableManager') private readonly variableManager: VariableManager,
    @inject('segment') public segment: Segment,

    @inject('logger') private readonly logger: AbstractLogger
  ) {}

  formatMultipleTypesValue = (filter: Filter): string => {
    let result = '';

    switch (filter.type) {
      case 'setpts': {
        // Retrieve speed from section option
        const speed = this.segment.currentSection?.options?.speed;

        // Speed < 1 accelerates video (0.25 = 4x faster)
        // Directly use speed value as PTS multiplier, normal speed otherwise
        result = speed ? `setpts=${speed}*PTS` : 'setpts=PTS';
        break;
      }

      case 'atempo': {
        // For audio, we need to use inverse of speed to stay in sync
        const speed = this.segment.currentSection?.options?.speed ?? 1;
        const audioSpeed = 1 / speed;

        // Limits for audio compatibility (0.5 to 2.0)
        const safeAudioSpeed = Math.max(0.5, Math.min(2.0, audioSpeed));
        result = `atempo=${safeAudioSpeed}`;
        break;
      }

      default:
        result = `${filter.type}=${filter.value}`;
    }

    return result;
  };

  private formatTextValue(key: string, values: ExtendedFilterValues): string | null {
    const textValue = values.text;

    if (textValue) {
      return `${key}='${this.formatText(textValue)}'`;
    }

    return null;
  }

  private formatDurationValue(key: string, values: ExtendedFilterValues, duration: number | undefined): string | null {
    const rawValue = values[key];

    if (rawValue === undefined) {
      return null;
    }

    const transitionDuration = this.template.descriptor.global?.transitionDuration?.toString() ?? '0';
    let durationStr = rawValue.toString().replace('{{ transitionDuration }}', transitionDuration);

    if (duration !== undefined) {
      durationStr = durationStr.replace('{{ section_duration }}', duration.toString());
    }

    if (!isNaN(Number(durationStr))) {
      return `${key}='${durationStr}'`;
    }

    return null;
  }

  private formatStartTimeValue(
    key: string,
    values: ExtendedFilterValues,
    duration: number | undefined,
    speed: number | undefined
  ): string | null {
    const rawValue = values[key];

    if (typeof rawValue !== 'string') {
      return null;
    }

    let stTime = duration ?? 0;

    if (speed !== undefined) {
      stTime *= speed;
    }

    stTime = parseFloat(stTime.toString()) - (this.template.descriptor.global?.transitionDuration ?? 0);
    const startTimeStr = rawValue.replace('{{ transitionStartTime }}', stTime.toString());

    if (!isNaN(Number(startTimeStr))) {
      return `${key}='${startTimeStr}'`;
    }

    return null;
  }

  private resolveColorFromValues(key: string, values: ExtendedFilterValues): string {
    const colorValue = values[key];

    return typeof colorValue === 'string' ? colorValue : '';
  }

  private formatColorValue(key: string, values: ExtendedFilterValues): string {
    return `${key}='${this.formatColor(this.resolveColorFromValues(key, values))}'`;
  }

  private formatFontValue(values: ExtendedFilterValues): string {
    return `fontfile='${this.formatFont(values.fontfile ?? '')}'`;
  }

  private formatDefaultValue(key: string, values: ExtendedFilterValues): string {
    const val = values[key];
    const stringVal = val === undefined ? '' : String(val);

    return `${key}=${stringVal}`;
  }

  formatMultipleTypesValues = (filter: Filter): string => {
    const filterValues = filter.values as ExtendedFilterValues | undefined;

    if (!filterValues) {
      return `${filter.type}=`;
    }

    const duration = this.segment.currentSection?.options?.duration;
    const speed = this.segment.currentSection?.options?.speed;
    const parts: string[] = [];

    for (const key of Object.keys(filterValues)) {
      this.appendFormattedValue(key, filterValues, duration, speed, parts);
    }

    return `${filter.type}=${parts.join(':')}`;
  };

  private appendFormattedValue(
    key: string,
    filterValues: ExtendedFilterValues,
    duration: number | undefined,
    speed: number | undefined,
    parts: string[]
  ): void {
    switch (key) {
      case 'text': {
        const formatted = this.formatTextValue(key, filterValues);

        if (formatted !== null) {
          parts.push(formatted);
        }

        break;
      }
      case 'duration':
      case 'd': {
        const formatted = this.formatDurationValue(key, filterValues, duration);

        if (formatted !== null) {
          parts.push(formatted);
        }

        break;
      }

      case 'start_time':
      case 'st': {
        const formatted = this.formatStartTimeValue(key, filterValues, duration, speed);

        if (formatted !== null) {
          parts.push(formatted);
        }

        break;
      }

      case 'boxcolor':
      case 'fontcolor':
      case 'fontcolor_expr':
      case 'color':
      case 'c':
        parts.push(this.formatColorValue(key, filterValues));
        break;

      case 'fontfile':
        parts.push(this.formatFontValue(filterValues));
        break;

      default:
        parts.push(this.formatDefaultValue(key, filterValues));
    }
  }

  /**
   * Applies text formatting for video overlay
   */
  formatText(text: string | Record<string, string | undefined>): string {
    // Use i18n
    const currentLocale = this.project.config.currentLocale ?? '';
    const rawText = typeof text === 'string' ? text : (text[currentLocale] ?? '');

    // Replace variables
    let result = this.variableManager.mapVariables(rawText);

    // Replace form fields
    result = this.variableManager.mapFields(result);

    // Manage reserved keywords or special characters
    // (', %, :)
    result = result.replace(/[:'%]/g, (char: string) => TEXT_ESCAPES[char] ?? char);

    // Upper case
    if (this.segment.currentSection?.options?.upperCase) {
      result = result.toUpperCase();
    }

    // Lower case
    if (this.segment.currentSection?.options?.lowerCase) {
      result = result.toLowerCase();
    }

    return result;
  }

  /**
   * Resolves font file path
   */
  formatFont(fontFile: string): string {
    if (this.template.assets.fonts[fontFile]) {
      const font = this.template.assets.fonts[fontFile];
      this.logger.info(`[${this.segment.currentSection?.name}][Font] loaded from cache font ${font}`);

      return font;
    }

    const font = `${this.segment.fontsDir}/${fontFile}`;

    if (!this.segment.tempFonts.includes(fontFile)) {
      this.segment.tempFonts.push(fontFile);
      this.logger.info(`[${this.segment.currentSection?.name}][Font] Added font to queue download ${fontFile}`);
    }

    return font;
  }

  /**
   * Replace color variables and handle both HEX and RGB formats
   */
  formatColor = (color: string): string => {
    // Handle undefined or null color values with a default
    if (!color) {
      return 'black';
    }

    if (!this.template.descriptor.global?.variables?.colorsList) {
      return this.variableManager.mapVariables(color) || 'black';
    }

    const colorsList = this.template.descriptor.global.variables.colorsList;

    // Resolve every `{{ colorN }}` tag in a single pass instead of scanning the whole
    // string once per color. `seen` preserves the original "replace first occurrence
    // only" semantics, and RGB->HEX is computed lazily for tags actually present.
    const seen = new Set<string>();

    return color.replace(/\{\{ color(\d+) \}\}/g, (match, indexStr) => {
      const index = Number(indexStr) - 1;

      if (index < 0 || index >= colorsList.length || seen.has(match)) {
        return match;
      }

      seen.add(match);
      const colorValue = colorsList[index];

      return colorValue.startsWith('rgb') ? this.convertRGBToHex(colorValue) : colorValue;
    });
  };

  /**
   * Convert RGB to HEX format
   */
  convertRGBToHex = (rgb: string): string => {
    const rgbArray = (rgb.match(/\d+/g) ?? []).map(Number);

    return `#${((1 << 24) + ((rgbArray[0] ?? 0) << 16) + ((rgbArray[1] ?? 0) << 8) + (rgbArray[2] ?? 0)).toString(16).slice(1).toUpperCase()}`;
  };
}

export default FormatterManager;
