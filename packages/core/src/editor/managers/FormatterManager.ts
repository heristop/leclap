import { inject, injectable, singleton } from 'tsyringe';
import type AbstractLogger from '../../platform/logging/AbstractLogger';
import type Template from '../../core/models/Template';
import type Segment from '../../core/models/Segment';
import type Project from '../../core/models/Project';
import type { Filter } from '@/core/types';
import type VariableManager from './VariableManager';

@injectable()
class FormatterManager {


  constructor(
    @inject('project') private readonly project: Project,
    @inject('template') private readonly template: Template,
    @inject('VariableManager') private readonly variableManager: VariableManager,
    @inject('segment') public segment: Segment,

    @inject('logger') private readonly logger: AbstractLogger
  ) { }

  formatMultipleTypesValue = (filter: Filter): string => {
    let result = '';

    switch (filter.type) {
      case 'setpts': {
        // Retrieve speed from section option
        const speed = this.segment.currentSection.options.speed;

        // Speed < 1 accelerates video (0.25 = 4x faster)
        if (speed) {
          // Directly use speed value as PTS multiplier
          result = `setpts=${speed}*PTS`;
        } else {
          result = 'setpts=PTS'; // Normal speed
        }
        break;
      }

      case 'atempo': {
        // For audio, we need to use inverse of speed to stay in sync
        const speed = this.segment.currentSection.options.speed || 1;
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

  formatMultipleTypesValues = (filter: Filter): string => {
    const values: string[] = [];

    for (const key in filter.values) {
      switch (key) {
        case 'text': {
          const textValue = filter.values[key.toString()];

          if (textValue) {
            values.push(`${key}='${this.formatText(textValue)}'`);
          }

          break;
        }
        case 'duration':
        case 'd': {
          let duration = filter.values[key]
            .toString()
            .replace('{{ transitionDuration }}', this.template.descriptor.global?.transitionDuration?.toString() || '0');

          const dTime = this.segment.currentSection.options.duration;
          duration = duration.replace('{{ section_duration }}', dTime.toString());

          if (!isNaN(Number(duration))) {
            values.push(`${key}='${duration}'`);
          }

          break;
        }

        case 'start_time':
        case 'st': {
          let stTime = this.segment.currentSection.options.duration;

          if (this.segment.currentSection.options.speed) {
            stTime *= this.segment.currentSection.options.speed;
          }

          stTime = parseFloat(stTime.toString()) - (this.template.descriptor.global?.transitionDuration || 0);
          const startTimeStr = filter.values[key].replace('{{ transitionStartTime }}', stTime.toString());

          if (!isNaN(Number(startTimeStr))) {
            values.push(`${key}='${startTimeStr}'`);
          }

          break;
        }

        case 'boxcolor':
        case 'fontcolor':
        case 'fontcolor_expr':
        case 'color':
        case 'c':
          values.push(`${key}='${this.formatColor(filter.values[key])}'`);
          break;

        case 'fontfile':
          values.push(`${key}='${this.formatFont(filter.values[key])}'`);
          break;

        default:
          values.push(`${key}=${filter.values[key]}`);
      }
    }

    return `${filter.type}=${values.join(':')}`;
  };

  /**
   * Applies text formatting for video overlay
   */
  formatText(text: string): string {
    // Use i18n
    const currentLocale = this.project.config.currentLocale;
    text = text[currentLocale] ? text[currentLocale] : text;

    // Replace variables
    text = this.variableManager.mapVariables(text);

    // Replace form fields
    text = this.variableManager.mapFields(text);

    // Manage reserved keywords or special characters
    // (', %, :)
    text = text.replace(new RegExp(/:/, 'g'), '\\\u003A');
    text = text.replace(new RegExp(/'/, 'g'), '\u2019');
    text = text.replace(new RegExp(/%/, 'g'), '\\\\\\\u0025');

    // Upper case
    if (this.segment.currentSection.options.upperCase) {
      text = text.toUpperCase();
    }

    // Lower case
    if (this.segment.currentSection.options.lowerCase) {
      text = text.toLowerCase();
    }

    return text;
  }

  /**
   * Resolves font file path
   */
  formatFont(fontFile: string): string {
    let font = '';

    if (this.template.assets.fonts[fontFile]) {
      font = this.template.assets.fonts[fontFile];
      this.logger.info(`[${this.segment.currentSection.name}][Font] loaded from cache font ${font}`);
    } else {
      font = `${this.segment.fontsDir}/${fontFile}`;

      if (!this.segment.tempFonts.includes(fontFile)) {
        this.segment.tempFonts.push(fontFile);
        this.logger.info(`[${this.segment.currentSection.name}][Font] Added font to queue download ${fontFile}`);
      }
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

    if (!this.template.descriptor.global.variables?.colorsList) {
      return this.variableManager.mapVariables(color) || 'black';
    }

    for (let i = 0; i < this.template.descriptor.global.variables.colorsList.length; i++) {
      const colorTag = `{{ color${i + 1} }}`;
      let colorValue = this.template.descriptor.global.variables.colorsList[i];

      // Check if the color format is RGB
      if (colorValue.startsWith('rgb')) {
        colorValue = this.convertRGBToHex(colorValue);
      }

      color = color.replace(colorTag, colorValue);
    }

    return color;
  };

  /**
   * Convert RGB to HEX format
   */
  convertRGBToHex = (rgb: string): string => {
    const rgbArray = rgb.match(/\d+/g).map(Number);
    return `#${((1 << 24) + (rgbArray[0] << 16) + (rgbArray[1] << 8) + rgbArray[2]).toString(16).slice(1).toUpperCase()}`;
  };
}

export default FormatterManager;
