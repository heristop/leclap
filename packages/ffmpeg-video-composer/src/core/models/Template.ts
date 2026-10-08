import { singleton } from 'tsyringe';
import type { TemplateAssets } from '../types';
import type { TemplateDescriptor } from '../../schemas/template.schemas';
import { BaseTemplateValidator, type ValidationResult } from '../../services/BaseTemplateValidator';

function isTemplateDescriptor(data: unknown): data is TemplateDescriptor {
  return typeof data === 'object' && data !== null && !('name' in data && 'type' in data);
}

/** What the host engine can draw beyond the common set. */
export interface TemplateCapabilities {
  /** HTML layers (`inputs[].type: "html"`): true where a rasteriser is registered. Default false. */
  htmlLayers?: boolean;
}

@singleton()
class Template {
  public descriptor: TemplateDescriptor = {};
  public assets: TemplateAssets = {
    fonts: {},
    musics: {},
    inputs: [],
  };
  private readonly validator: BaseTemplateValidator;

  constructor(capabilities: TemplateCapabilities = {}) {
    // Template is the browser / on-device validation path: those engines cannot analyze music nor
    // transcribe speech (both are pinned before compile). HTML layers render where the host registered a
    // rasteriser: the browser compile says so, the on-device engine cannot yet.
    this.validator = new BaseTemplateValidator({
      beatsAnalysis: false,
      transcription: false,
      htmlLayers: capabilities.htmlLayers ?? false,
    });
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

    if (validation.success && validation.data && isTemplateDescriptor(validation.data)) {
      this.descriptor = validation.data;
    }

    return validation;
  };

  validateDescriptor = (): ValidationResult => {
    return this.validator.validateTemplate(this.descriptor);
  };

  loadFromJSON = (jsonString: string): ValidationResult => {
    const validation = this.validator.validateTemplateFromJSON(jsonString);

    if (validation.success && validation.data && isTemplateDescriptor(validation.data)) {
      this.descriptor = validation.data;
    }

    return validation;
  };

  clean = (): void => {
    this.init();
  };
}

export default Template;

export { assertEffectsResolved } from '../partials';
