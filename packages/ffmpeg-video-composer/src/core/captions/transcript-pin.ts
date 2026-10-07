// Pinning a transcript: the section's `subtitles.transcribe` request is replaced by `subtitles.words`,
// and `meta.resolved.transcripts[section]` records the engine, model, language, clip digest and date, so a
// render only ever reads pinned words and `transcript_stale` can tell when the clip changed. Pure.

import type { TranscriptRecord } from '../../schemas/transcribe.schemas';
import type { MotionWarning } from '../../services/motion-lint';
import type { TranscriptWord } from './transcript-time';

type LooseDescriptor = { meta?: unknown; sections?: unknown };
type LooseSection = { name?: unknown; subtitles?: Record<string, unknown> };

/** The descriptor with section `index` pinned to `words` (input untouched). */
export function pinTranscript<T extends LooseDescriptor>(
  descriptor: T,
  index: number,
  words: readonly TranscriptWord[],
  record: TranscriptRecord,
  subtitles: Record<string, unknown> = {}
): T {
  const sections = [...((descriptor.sections as LooseSection[] | undefined) ?? [])];
  const section = sections[index];
  const { transcribe: _request, ...kept } = section.subtitles ?? {};

  sections[index] = { ...section, subtitles: { ...kept, ...subtitles, words: [...words] } };

  const meta = (descriptor.meta ?? {}) as { resolved?: { transcripts?: Record<string, TranscriptRecord> } };
  const transcripts = { ...meta.resolved?.transcripts, [String(section.name)]: record };

  return { ...descriptor, meta: { ...meta, resolved: { ...meta.resolved, transcripts } }, sections };
}

/** The pinned transcript records of a descriptor, by section name. */
export function transcriptRecords(descriptor: unknown): Record<string, TranscriptRecord> {
  const meta = (descriptor as { meta?: { resolved?: { transcripts?: unknown } } } | null)?.meta;
  const transcripts = meta?.resolved?.transcripts;

  return transcripts && typeof transcripts === 'object' ? (transcripts as Record<string, TranscriptRecord>) : {};
}

/**
 * transcript_stale: a pinned transcript whose source clip no longer has the digest it was transcribed
 * from. `current` maps the source section name to the clip's digest now (sections not measured are skipped).
 */
export function staleTranscripts(descriptor: unknown, current: Partial<Record<string, string>>): MotionWarning[] {
  return Object.entries(transcriptRecords(descriptor)).flatMap(([section, record]) => {
    const now = current[record.from];

    if (!record.digest || now === undefined || now === record.digest) return [];

    const warning: MotionWarning = {
      path: `meta.resolved.transcripts.${section}`,
      code: 'transcript_stale',
      severity: 'warn',
      message: `Section "${section}": its captions were transcribed from a different "${record.from}" clip`,
      hint: "Re-transcribe (`leclap transcribe <template> --force` or the app's Captions toggle) so the words match the new take.",
    };

    return [warning];
  });
}
