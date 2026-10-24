import type { Section } from '@/src/types';

// Icon names used for section types. A local string-literal union (assignable to the Icon `name` prop)
// keeps this out of section-status.ts so the pure gating logic imports no native modules and stays
// unit-testable under ts-jest.
export type SectionIcon = 'video' | 'file-text' | 'music' | 'image' | 'file';

export const SECTION_ICONS: Record<string, SectionIcon> = {
  project_video: 'video',
  form: 'file-text',
  music: 'music',
  picture: 'image',
};

export function getSectionIcon(section: Section): SectionIcon {
  return SECTION_ICONS[section.type] ?? 'file';
}
