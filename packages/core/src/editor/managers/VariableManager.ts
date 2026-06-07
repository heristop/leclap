import { inject, injectable } from 'tsyringe';
import type Template from '../../core/models/Template';
import type Project from '../../core/models/Project';
import type { Variables } from '@/core/types';

@injectable()
class VariableManager {
  constructor(
    @inject('template') private readonly template: Template,
    @inject('project') private readonly project: Project
  ) { }

  mapVariables = (value: string): string => {
    const variables = this.template.descriptor.global?.variables;

    if (!variables) {
      return value;
    }

    return this.mapPlaceholders(value, variables);
  };

  private readonly mapPlaceholders = (value: string, placeholders: Variables): string => {
    const keys = Object.keys(placeholders);

    if (keys.length === 0) {
      return value;
    }

    // Resolve every placeholder in a single pass with one compiled regex instead of
    // recompiling a RegExp and re-scanning the whole string once per variable.
    const pattern = new RegExp(keys.map((key) => VariableManager.escapeRegExp(`{{ ${key} }}`)).join('|'), 'g');

    return value.replace(pattern, (match) => {
      // Recover the key from the matched "{{ key }}" placeholder.
      const placeholderValue = placeholders[match.slice(3, -3)];

      return Array.isArray(placeholderValue) ? placeholderValue.join(', ') : placeholderValue;
    });
  };

  private static escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  }

  /**
   * Replace fields
   */
  mapFields = (value: string): string => {
    const { fields } = this.project.config;

    if (!fields) {
      return value;
    }

    return this.mapPlaceholders(value, fields);
  };
}

export default VariableManager;
