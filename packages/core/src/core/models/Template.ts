import { singleton } from 'tsyringe';
import { TemplateAssets } from '../types';
import { TemplateDescriptor } from '../../schemas/template.schemas';
import { TemplateValidator, ValidationResult } from '../../services/TemplateValidator';

@singleton()
class Template {
  public descriptor: TemplateDescriptor;
  public assets: TemplateAssets;
  private validator: TemplateValidator;

  constructor() {
    this.validator = new TemplateValidator();
    this.init();
  }

  init = (): void => {
    this.assets = {
      fonts: {},
      musics: {},
      inputs: [],
    };
  };

  setDescriptor = (descriptor: unknown): ValidationResult => {
    const validation = this.validator.validateTemplate(descriptor);

    if (validation.success && validation.data) {
      this.descriptor = validation.data;
    }

    return validation;
  };

  validateDescriptor = (): ValidationResult => {
    return this.validator.validateTemplate(this.descriptor);
  };

  loadFromJSON = (jsonString: string): ValidationResult => {
    const validation = this.validator.validateTemplateFromJSON(jsonString);

    if (validation.success && validation.data) {
      this.descriptor = validation.data;
    }

    return validation;
  };

  clean = (): void => this.init();
}

export default Template;
