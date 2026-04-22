import { inject, injectable, singleton } from 'tsyringe';
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

  private mapPlaceholders = (value: string, placeholders: Variables): string => {
    if (placeholders && Object.keys(placeholders).length > 0) {
      for (const key of Object.keys(placeholders)) {
        const placeholder = `{{ ${key} }}`;
        const placeholderValue = placeholders[key];

        const valueToReplace = Array.isArray(placeholderValue) ? placeholderValue.join(', ') : placeholderValue;

        value = value.replace(new RegExp(placeholder, 'g'), valueToReplace);
      }
    }

    return value;
  };

  /**
   * Replace fields
   */
  mapFields = (value: string): string => {
    const { fields } = this.project.config;

    return this.mapPlaceholders(value, fields);
  };
}

export default VariableManager;
