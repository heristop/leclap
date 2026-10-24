import {
  Braces,
  FileText,
  Image as ImageIcon,
  Music,
  Palette,
  Video,
  type IconComponent,
} from '@/presentation/components/icons';

// Shared section-type metadata, reused by the add-section menu, the template poster glyph strip, and
// anywhere a section needs a consistent icon.
export type SectionKind = 'video' | 'form' | 'color' | 'music' | 'image' | 'partial';

export const SECTION_KINDS: SectionKind[] = ['video', 'form', 'color', 'music', 'image', 'partial'];

export const SECTION_ICON: Record<SectionKind, IconComponent> = {
  video: Video,
  form: FileText,
  color: Palette,
  music: Music,
  image: ImageIcon,
  partial: Braces,
};

export type SectionCategory = 'clip' | 'input' | 'data';

// How the section kinds group in the add-section palette: visual clips vs. user input vs. data.
export const SECTION_CATEGORY: Record<SectionKind, SectionCategory> = {
  video: 'clip',
  color: 'clip',
  image: 'clip',
  form: 'input',
  music: 'data',
  partial: 'data',
};
