// Pins an on-device transcript into the descriptor the app compiles: `subtitles.words` in section
// seconds, the `transcribe` request (and any authored cues / SRT it replaces) dropped, and the pin
// recorded under `meta.resolved.transcripts[section]` (engine, language, date, mean confidence) so a
// pinned transcript reads apart from authored captions. The device engine never transcribes: an
// unresolved `transcribe` fails its compile with transcribe_unavailable, so every request is pinned here.

import { meanConfidence, type TranscriptWord } from './transcript-mapping';

export interface TranscriptRecord {
  from: 'self';
  engine: string;
  language?: string;
  model?: string;
  digest?: string;
  at?: string;
  confidence?: number;
}

interface PinOptions {
  /** The recogniser gave phrase timings only: karaoke degrades to phrase highlighting. */
  coarse?: boolean;
}

type Subtitles = Record<string, unknown>;

interface LooseSection {
  name?: string;
  subtitles?: Subtitles;
  [key: string]: unknown;
}

interface LooseDescriptor {
  meta?: Record<string, unknown>;
  sections?: LooseSection[];
  [key: string]: unknown;
}

function pinnedSubtitles(existing: Subtitles | undefined, words: TranscriptWord[], coarse: boolean): Subtitles {
  if (!existing) return { words, style: 'clean', karaoke: coarse ? false : 'word' };

  const { transcribe: _request, cues: _cues, srt: _srt, ...look } = existing;

  return { ...look, words, ...(coarse && { karaoke: false }) };
}

function withRecord(meta: Record<string, unknown> | undefined, name: string, record: TranscriptRecord) {
  const resolved = (meta?.resolved ?? {}) as { transcripts?: Record<string, TranscriptRecord> };

  return { ...meta, resolved: { ...resolved, transcripts: { ...resolved.transcripts, [name]: record } } };
}

export function pinTranscript<T extends LooseDescriptor>(
  descriptor: T,
  sectionName: string,
  words: TranscriptWord[],
  record: TranscriptRecord,
  options: PinOptions = {}
): T {
  const sections = descriptor.sections ?? [];

  if (!sections.some((section) => section.name === sectionName)) return descriptor;

  const confidence = meanConfidence(words);

  return {
    ...descriptor,
    meta: withRecord(descriptor.meta, sectionName, { ...record, ...(confidence !== undefined && { confidence }) }),
    sections: sections.map((section) =>
      section.name === sectionName
        ? { ...section, subtitles: pinnedSubtitles(section.subtitles, words, options.coarse ?? false) }
        : section
    ),
  };
}

/** Names of the sections whose subtitles still ask for a transcription. */
export function unpinnedTranscriptions(descriptor: LooseDescriptor): string[] {
  return (descriptor.sections ?? []).flatMap((section) =>
    section.subtitles?.transcribe !== undefined && section.name ? [section.name] : []
  );
}
