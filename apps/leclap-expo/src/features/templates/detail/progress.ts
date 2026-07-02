import type { Template, Section, Project } from '@/src/types';
import { isSectionCompleted } from '@/src/features/templates/detail/section-status';

// Every editable section done AND (no media step, or the media step done). A loaded template with no
// editable sections (a premium colour/text card) is vacuously ready — `every` is true for the empty
// list — so it falls through to the media-step check. Returns false while still loading.
export function computeAllDone(
  project: Project | null,
  template: Template | null | undefined,
  filteredSections: Section[],
  hasMediaStep: boolean,
  mediaStepDone: boolean
): boolean {
  if (project === null || !template) return false;

  if (!filteredSections.every((s) => isSectionCompleted(s, project))) return false;

  return !hasMediaStep || mediaStepDone;
}

// The shot-list fraction: editable sections + the optional media step, and how many are done.
export function computeProgress(
  filteredSections: Section[],
  completedSectionsCount: number,
  hasMediaStep: boolean,
  mediaStepDone: boolean
): { totalItems: number; totalDone: number } {
  const mediaItem = hasMediaStep ? 1 : 0;
  const mediaDone = hasMediaStep && mediaStepDone ? 1 : 0;

  return {
    totalItems: filteredSections.length + mediaItem,
    totalDone: completedSectionsCount + mediaDone,
  };
}
