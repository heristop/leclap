import type { Section } from '@/src/types';

// Ionicons glyph names used for section types. A local string-literal union (assignable to the
// Ionicons `name` prop) keeps this out of section-status.ts so the pure gating logic imports no native
// modules and stays unit-testable under ts-jest.
export type SectionIcon = 'videocam' | 'document-text' | 'musical-notes' | 'image' | 'document';

export const SECTION_ICONS: Record<string, SectionIcon> = {
  project_video: 'videocam',
  form: 'document-text',
  music: 'musical-notes',
  picture: 'image',
};

export function getSectionIcon(section: Section): SectionIcon {
  return SECTION_ICONS[section.type] ?? 'document';
}
