import type { TFunction } from 'i18next';
import type { Template, Section, Project, MediaChoice } from '@/src/types';
import { buildDescriptionVars, resolveVariables } from '@/src/utils/i18nText';
import { MUSIC_LIBRARY } from '@/src/data/mediaCatalog';

// The header blurb is the first section's description — interpolate its `{{ tokens }}` against the
// template's variable defaults + the user's answers so it reads with real values (web parity).
export function buildHeaderDescription(
  template: Template | undefined,
  project: Project | null,
  t: TFunction<'detail'>
): string {
  const raw = template?.content.sections?.find((s) => s.description?.en)?.description?.en;

  if (!template || !raw) return t('defaultDescription');

  const vars = buildDescriptionVars(
    template.content.global?.variables,
    template.content.global?.colorsList,
    project?.formData
  );

  return resolveVariables(raw, vars);
}

// The currently-stored track id for a music section (or undefined when none chosen yet).
export function activeMusicSelection(project: Project, section: Section | null): string | undefined {
  if (!section) return undefined;

  return project.formData[`music_${section.name}`] as string | undefined;
}

// The template's authored soundtrack as a library MediaChoice, so the Music step opens pre-selected on
// the track the template ships with (web parity). Only when music is enabled and the default is one of
// the offered tracks; otherwise null (leave the step empty).
export function defaultMusicChoice(template: Template): MediaChoice | null {
  const global = template.content.global;
  const name = global?.music?.name;

  if (!global?.musicEnabled || !name) return null;

  const track = MUSIC_LIBRARY.find((m) => m.file === name);

  if (!track) return null;

  const allowed = global.allowedMusic;

  if (allowed && allowed.length > 0 && !allowed.includes(track.id)) return null;

  return { kind: 'library', id: track.id };
}
