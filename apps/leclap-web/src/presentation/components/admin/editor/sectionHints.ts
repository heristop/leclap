// Noob on-ramp microcopy + collapsed-disclosure summary chips. All pure string helpers so they're
// unit-testable and reusable across the Add-section row and the section cards.
import type { TFunction } from 'i18next';
import type { EditorSection, FramingGuide, Grade, MotionEffect } from '../templateEditorModel';

const TITLE_CASE = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

export const SECTION_HINTS = {
  video: 'Record yourself on camera',
  form: 'Ask the viewer for text to overlay',
  color: 'Solid color card with a title',
  music: 'Background track for the whole video',
  image: 'A photo backdrop with motion',
} satisfies Record<EditorSection['kind'], string>;

// "Effects" group summary: the active look + Ken Burns move, or "None". `motion` is optional so
// video/color callers (no motion) can omit it.
export function effectsSummary(t: TFunction<'admin'>, look: string | undefined, motion?: MotionEffect[]): string {
  const parts: string[] = [];

  if (look) parts.push(TITLE_CASE(look));

  const kenburns = (motion ?? []).some((m) => m.type === 'kenburns');

  if (kenburns) parts.push(t('summaryChip.kenBurns'));

  return parts.length > 0 ? parts.join(' · ') : t('summaryChip.none');
}

// Label for the active fade combination ('' when neither side fades).
function fadeLabel(t: TFunction<'admin'>, hasIn: boolean, hasOut: boolean): string {
  if (hasIn && hasOut) return t('summaryChip.fadeInOut');

  if (hasIn) return t('summaryChip.fadeIn');

  if (hasOut) return t('summaryChip.fadeOut');

  return '';
}

// "Audio" group summary: which fades are active + a volume override, or "Default".
export function audioSummary(
  t: TFunction<'admin'>,
  fade: { in?: unknown; out?: unknown } | undefined,
  hasVolumeOverride: boolean
): string {
  const parts: string[] = [];
  const fades = fadeLabel(t, Boolean(fade?.in), Boolean(fade?.out));

  if (fades) parts.push(fades);

  if (hasVolumeOverride) parts.push(t('summaryChip.customVolume'));

  return parts.length > 0 ? parts.join(' · ') : t('summaryChip.default');
}

// "Camera guide" group summary: the silhouette position, or "Off".
export function framingSummary(t: TFunction<'admin'>, guide: FramingGuide | undefined): string {
  if (!guide) return t('summaryChip.off');

  return TITLE_CASE(guide.position);
}

// A grade counts toward the Effects summary's "edited" state too; exposed for callers that show a
// dot/marker when fine-tune values are non-default.
export const hasGrade = (grade: Grade | undefined): boolean => grade !== undefined;
