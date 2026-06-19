import { Video, FileText, type LucideIcon } from '@/presentation/components/icons';
import type { InputSection } from '@/services/templateService';

// Per-item framing: each section announces its task type rather than hiding under one umbrella word.
// A clip section is a "record" task (film/upload), a form section is a "details" task (fill fields).
// Single source for the glyph + i18n label, reused by the filmstrip cell, panel header and preview.
export type SectionKind = 'record' | 'details';

export interface SectionKindMeta {
  kind: SectionKind;
  Icon: LucideIcon;
  labelKey: 'editor.record' | 'editor.details';
}

export const sectionKindMeta = (section: InputSection): SectionKindMeta =>
  section.kind === 'clip'
    ? { kind: 'record', Icon: Video, labelKey: 'editor.record' }
    : { kind: 'details', Icon: FileText, labelKey: 'editor.details' };
