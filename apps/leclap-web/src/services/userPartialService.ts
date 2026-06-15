import { TemplateDescriptorSchema } from 'ffmpeg-video-composer/src/schemas/template.schemas.ts';
import type { TemplatePartial } from '@leclap/creative-kit/partials';
import { UserPartialService } from '@/stores/userPartialStore';

export type { StoredPartial } from '@/stores/userPartialStore';

function safeLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export const userPartialService = new UserPartialService(safeLocalStorage(), {
  validatePartial: (partial: TemplatePartial) => {
    if (!Array.isArray(partial.sections) || partial.sections.length === 0) {
      return { success: false, errors: [{ message: 'partial must contain at least one section' }] };
    }

    const result = TemplateDescriptorSchema.safeParse({ sections: partial.sections });

    if (result.success) return { success: true };

    return { success: false, errors: result.error.issues.map((issue) => ({ message: issue.message })) };
  },
});
