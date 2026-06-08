import { TemplateValidator } from 'ffmpeg-video-composer/src/services/TemplateValidator.ts';
import { UserTemplateService } from '@/stores/userTemplateStore';

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
  validateTemplate: (descriptor) => validator.validateTemplate(descriptor),
});
