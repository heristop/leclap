import { TemplateValidator } from 'ffmpeg-video-composer/src/services/TemplateValidator.ts';
import type { TemplateDescriptor } from 'ffmpeg-video-composer/src/core/types.d.ts';
import { UserTemplateService } from '@/stores/userTemplateStore';
import { materializeTemplatePartials } from '@/services/templatePartialService';

export type { StoredTemplate } from '@/stores/userTemplateStore';

function safeLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

// Wire the pure store to real localStorage + the core descriptor validator.
const validator = new TemplateValidator();

export const userTemplateService = new UserTemplateService(safeLocalStorage(), {
  validateTemplate: (descriptor) => {
    try {
      return validator.validateTemplate(materializeTemplatePartials(descriptor as TemplateDescriptor));
    } catch (error) {
      return {
        success: false,
        errors: [{ message: error instanceof Error ? error.message : 'Could not expand template partials' }],
      };
    }
  },
});
