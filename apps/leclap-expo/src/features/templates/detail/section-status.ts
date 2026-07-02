import type { Template, Section, Project } from '@/src/types';

// The section types a viewer actually fills in (everything else is authored into the template).
export const EDITABLE_TYPES = ['project_video', 'form', 'music', 'picture'] as const;

// A section counts as done when its input exists: a recorded clip/picture, every form field answered,
// or a music choice stored. Pure — no React — so the gating logic is unit-tested in isolation.
export function isSectionCompleted(section: Section, project: Project): boolean {
  if (section.type === 'project_video' || section.type === 'picture') {
    return Boolean(project.recordedVideos[section.name]);
  }

  if (section.type === 'form') return (section.options?.fields ?? []).every((f) => Boolean(project.formData[f.name]));

  if (section.type === 'music') return Boolean(project.formData[`music_${section.name}`]);

  return false;
}

export function getSectionInfo(t: Template | undefined, p: Project | null): { filtered: Section[]; completed: number } {
  const filtered = (t?.content.sections ?? []).filter((s) => (EDITABLE_TYPES as readonly string[]).includes(s.type));

  return { filtered, completed: p ? filtered.filter((s) => isSectionCompleted(s, p)).length : 0 };
}
