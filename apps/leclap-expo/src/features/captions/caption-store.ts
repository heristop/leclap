// A section's pinned captions live in the project's form data under `captions:<section>` (like the
// `music_<section>` picks), so they persist with the project and survive app restarts without a new
// storage field. At compile they are pinned into the descriptor (pin-transcript.ts); a retake of the
// clip makes them stale (the transcribed path no longer matches the section's clip).

import { pinTranscript, type TranscriptRecord } from './pin-transcript';
import { spreadSegments, type TranscriptWord } from './transcript-mapping';

export interface SectionCaptions {
  /** Word timings in section seconds. */
  words: TranscriptWord[];
  /** Phrase-level timings only (karaoke degrades to phrase highlighting). */
  coarse: boolean;
  /** The clip that was transcribed. */
  clipPath: string;
  record: TranscriptRecord;
}

const PREFIX = 'captions:';

const keyOf = (sectionName: string): string => `${PREFIX}${sectionName}`;

function isSectionCaptions(value: unknown): value is SectionCaptions {
  const candidate = value as Partial<SectionCaptions> | null;

  return typeof candidate === 'object' && candidate !== null && Array.isArray(candidate.words);
}

export function readSectionCaptions(formData: Record<string, unknown>, sectionName: string): SectionCaptions | null {
  const value = formData[keyOf(sectionName)];

  return isSectionCaptions(value) ? value : null;
}

export function withSectionCaptions(
  formData: Record<string, unknown>,
  sectionName: string,
  captions: SectionCaptions | null
): Record<string, unknown> {
  const { [keyOf(sectionName)]: _previous, ...rest } = formData;

  return captions ? { ...rest, [keyOf(sectionName)]: captions } : rest;
}

/** The descriptor with every stored section transcript pinned (the input itself when there is none). */
export function applyCaptionPins<T extends { sections?: Array<{ name?: string }> }>(
  descriptor: T,
  formData: Record<string, unknown>
): T {
  let pinned = descriptor;

  for (const key of Object.keys(formData)) {
    const name = key.startsWith(PREFIX) ? key.slice(PREFIX.length) : null;
    const captions = name ? readSectionCaptions(formData, name) : null;

    if (name && captions) {
      pinned = pinTranscript(pinned, name, captions.words, captions.record, { coarse: captions.coarse });
    }
  }

  return pinned;
}

interface CaptionableProject {
  templateContent: { sections?: Array<{ name: string; type: string }> };
  recordedVideos: Record<string, unknown>;
}

/** Captions are offered on a video step (project_video) that already has its clip. */
export function isCaptionable(project: CaptionableProject | null | undefined, sectionName: string | undefined) {
  if (!project || !sectionName || !project.recordedVideos[sectionName]) return false;

  const section = project.templateContent.sections?.find((candidate) => candidate.name === sectionName);

  return section?.type === 'project_video';
}

export function hasSectionCaptions(
  project: { formData: Record<string, unknown> } | null | undefined,
  sectionName: string | undefined
): boolean {
  if (!project || !sectionName) return false;

  return readSectionCaptions(project.formData, sectionName) !== null;
}

export function isCaptionsStale(captions: SectionCaptions, clipPath: string): boolean {
  return captions.clipPath !== clipPath;
}

/** A word fixed by the user: cleared = removed, several words = its window shared by character count. */
export function editWord(words: readonly TranscriptWord[], index: number, text: string): TranscriptWord[] {
  const word = words[index] as TranscriptWord | undefined;

  if (!word) return [...words];

  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const replacement =
    tokens.length === 1
      ? [{ ...word, text: tokens[0] }]
      : spreadSegments([{ text: tokens.join(' '), start: word.start, end: word.end }]);

  return [...words.slice(0, index), ...replacement, ...words.slice(index + 1)];
}
