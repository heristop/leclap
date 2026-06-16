import { APP_PARTIALS, expandPartialsWithRegistry, type TemplatePartial } from '@leclap/creative-kit/partials';
import type { TemplateDescriptor as CreativeKitTemplateDescriptor } from '@leclap/creative-kit';
import type { TemplateDescriptor } from 'ffmpeg-video-composer/src/core/types.d.ts';
import { userPartialService, type StoredPartial } from '@/services/userPartialService';

export type AvailablePartial = TemplatePartial & {
  source: 'builtin' | 'local';
  readonly: boolean;
  updatedAt?: number;
};

export function listAvailablePartials(localPartials: StoredPartial[] = userPartialService.list()): AvailablePartial[] {
  return [
    ...APP_PARTIALS.map((partial) => ({ ...partial, source: 'builtin' as const, readonly: true })),
    ...localPartials.map((partial) => ({ ...partial, source: 'local' as const, readonly: false })),
  ];
}

export function materializeTemplatePartials(
  descriptor: TemplateDescriptor,
  localPartials: StoredPartial[] = userPartialService.list()
): TemplateDescriptor {
  const registry = listAvailablePartials(localPartials);

  return expandPartialsWithRegistry(
    descriptor as unknown as CreativeKitTemplateDescriptor,
    registry
  ) as unknown as TemplateDescriptor;
}
